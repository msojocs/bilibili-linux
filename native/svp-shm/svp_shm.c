#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <node_api.h>
#include <stdatomic.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>

#define SVP_SHM_MAGIC UINT64_C(0x53565053484d3031)
#define SVP_SHM_VERSION 1
#define SVP_SHM_HEADER_BYTES 4096
#define SVP_SHM_MAX_BYTES (UINT64_C(2) * 1024 * 1024 * 1024)
#define SVP_SHM_MAX_FRAME_BYTES (UINT64_C(128) * 1024 * 1024)
#define SVP_SHM_MAX_CAPACITY 512

typedef struct {
  uint64_t magic;
  uint32_t version;
  uint32_t header_bytes;
  uint64_t frame_bytes;
  uint32_t capacity;
  uint32_t reserved;
  _Atomic uint64_t write_sequence;
  _Atomic uint64_t read_sequence;
  _Atomic uint64_t skipped_frames;
  _Atomic uint32_t closed;
} svp_shm_header_t;

typedef struct {
  int fd;
  bool owner;
  bool explicitly_closed;
  char name[128];
  size_t mapping_bytes;
  uint8_t *mapping;
  svp_shm_header_t *header;
  uint8_t *frames;
  size_t partial_bytes;
} svp_shm_ring_t;

static napi_value throw_error(napi_env env, const char *operation, const char *detail) {
  char message[512];
  snprintf(message, sizeof(message), "%s: %s", operation, detail);
  napi_throw_error(env, NULL, message);
  return NULL;
}

static napi_value throw_errno(napi_env env, const char *operation) {
  return throw_error(env, operation, strerror(errno));
}

static bool get_uint64(napi_env env, napi_value value, uint64_t *output) {
  double number = 0;
  if (napi_get_value_double(env, value, &number) != napi_ok || number < 0 || number > 9007199254740991.0) {
    return false;
  }
  uint64_t integer = (uint64_t)number;
  if ((double)integer != number) return false;
  *output = integer;
  return true;
}

static bool get_name(napi_env env, napi_value value, char *output, size_t output_size) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, output, output_size, &length) != napi_ok) return false;
  if (length < 15 || length >= output_size || strncmp(output, "/bilibili-svp-", 14) != 0) return false;
  return strchr(output + 1, '/') == NULL;
}

static void close_ring(svp_shm_ring_t *ring) {
  if (!ring || ring->explicitly_closed) return;
  ring->explicitly_closed = true;
  if (ring->mapping && ring->mapping != MAP_FAILED) munmap(ring->mapping, ring->mapping_bytes);
  ring->mapping = NULL;
  if (ring->fd >= 0) close(ring->fd);
  ring->fd = -1;
  if (ring->owner && ring->name[0]) shm_unlink(ring->name);
}

static void finalize_ring(napi_env env, void *data, void *hint) {
  (void)env;
  (void)hint;
  svp_shm_ring_t *ring = data;
  close_ring(ring);
  free(ring);
}

static svp_shm_ring_t *unwrap_ring(napi_env env, napi_value value) {
  svp_shm_ring_t *ring = NULL;
  if (napi_unwrap(env, value, (void **)&ring) != napi_ok || !ring || ring->explicitly_closed || !ring->header) {
    throw_error(env, "svp-shm", "invalid or closed ring");
    return NULL;
  }
  return ring;
}

static void set_number(napi_env env, napi_value object, const char *key, double number) {
  napi_value value;
  napi_create_double(env, number, &value);
  napi_set_named_property(env, object, key, value);
}

static void set_bool(napi_env env, napi_value object, const char *key, bool boolean) {
  napi_value value;
  napi_get_boolean(env, boolean, &value);
  napi_set_named_property(env, object, key, value);
}

static napi_value wrap_ring(napi_env env, svp_shm_ring_t *ring) {
  napi_value object;
  napi_create_object(env, &object);
  napi_wrap(env, object, ring, finalize_ring, NULL, NULL);
  return object;
}

static bool validate_dimensions(uint64_t frame_bytes, uint64_t capacity, uint64_t *mapping_bytes) {
  if (!frame_bytes || frame_bytes > SVP_SHM_MAX_FRAME_BYTES || !capacity || capacity > SVP_SHM_MAX_CAPACITY) {
    return false;
  }
  if (frame_bytes > (SVP_SHM_MAX_BYTES - SVP_SHM_HEADER_BYTES) / capacity) return false;
  *mapping_bytes = SVP_SHM_HEADER_BYTES + frame_bytes * capacity;
  return true;
}

static napi_value create_ring(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  char name[128];
  uint64_t frame_bytes = 0;
  uint64_t capacity = 0;
  uint64_t mapping_bytes = 0;
  if (argc < 3 || !get_name(env, args[0], name, sizeof(name)) || !get_uint64(env, args[1], &frame_bytes)
      || !get_uint64(env, args[2], &capacity) || !validate_dimensions(frame_bytes, capacity, &mapping_bytes)) {
    return throw_error(env, "createRing", "invalid name, frame size or capacity");
  }

  shm_unlink(name);
  int fd = shm_open(name, O_CREAT | O_EXCL | O_RDWR | O_CLOEXEC, 0600);
  if (fd < 0) return throw_errno(env, "shm_open");
  if (ftruncate(fd, (off_t)mapping_bytes) != 0) {
    int saved_errno = errno;
    close(fd);
    shm_unlink(name);
    errno = saved_errno;
    return throw_errno(env, "ftruncate");
  }
  uint8_t *mapping = mmap(NULL, (size_t)mapping_bytes, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
  if (mapping == MAP_FAILED) {
    int saved_errno = errno;
    close(fd);
    shm_unlink(name);
    errno = saved_errno;
    return throw_errno(env, "mmap");
  }
  memset(mapping, 0, SVP_SHM_HEADER_BYTES);
  svp_shm_ring_t *ring = calloc(1, sizeof(*ring));
  if (!ring) {
    munmap(mapping, (size_t)mapping_bytes);
    close(fd);
    shm_unlink(name);
    return throw_error(env, "createRing", "out of memory");
  }
  ring->fd = fd;
  ring->owner = true;
  ring->mapping_bytes = (size_t)mapping_bytes;
  ring->mapping = mapping;
  ring->header = (svp_shm_header_t *)mapping;
  ring->frames = mapping + SVP_SHM_HEADER_BYTES;
  snprintf(ring->name, sizeof(ring->name), "%s", name);
  ring->header->magic = SVP_SHM_MAGIC;
  ring->header->version = SVP_SHM_VERSION;
  ring->header->header_bytes = SVP_SHM_HEADER_BYTES;
  ring->header->frame_bytes = frame_bytes;
  ring->header->capacity = (uint32_t)capacity;
  atomic_store_explicit(&ring->header->write_sequence, 0, memory_order_relaxed);
  atomic_store_explicit(&ring->header->read_sequence, 0, memory_order_relaxed);
  atomic_store_explicit(&ring->header->skipped_frames, 0, memory_order_relaxed);
  atomic_store_explicit(&ring->header->closed, 0, memory_order_release);
  return wrap_ring(env, ring);
}

static napi_value open_ring(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  char name[128];
  if (argc < 1 || !get_name(env, args[0], name, sizeof(name))) {
    return throw_error(env, "openRing", "invalid shared-memory name");
  }
  int fd = shm_open(name, O_RDWR | O_CLOEXEC, 0600);
  if (fd < 0) return throw_errno(env, "shm_open");
  struct stat info_buffer;
  if (fstat(fd, &info_buffer) != 0 || info_buffer.st_size < SVP_SHM_HEADER_BYTES
      || (uint64_t)info_buffer.st_size > SVP_SHM_MAX_BYTES) {
    close(fd);
    return throw_error(env, "openRing", "invalid shared-memory size");
  }
  uint8_t *mapping = mmap(NULL, (size_t)info_buffer.st_size, PROT_READ | PROT_WRITE, MAP_SHARED, fd, 0);
  if (mapping == MAP_FAILED) {
    close(fd);
    return throw_errno(env, "mmap");
  }
  svp_shm_header_t *header = (svp_shm_header_t *)mapping;
  uint64_t expected_bytes = 0;
  if (header->magic != SVP_SHM_MAGIC || header->version != SVP_SHM_VERSION
      || header->header_bytes != SVP_SHM_HEADER_BYTES
      || !validate_dimensions(header->frame_bytes, header->capacity, &expected_bytes)
      || expected_bytes != (uint64_t)info_buffer.st_size) {
    munmap(mapping, (size_t)info_buffer.st_size);
    close(fd);
    return throw_error(env, "openRing", "invalid shared-memory header");
  }
  svp_shm_ring_t *ring = calloc(1, sizeof(*ring));
  if (!ring) {
    munmap(mapping, (size_t)info_buffer.st_size);
    close(fd);
    return throw_error(env, "openRing", "out of memory");
  }
  ring->fd = fd;
  ring->mapping_bytes = (size_t)info_buffer.st_size;
  ring->mapping = mapping;
  ring->header = header;
  ring->frames = mapping + SVP_SHM_HEADER_BYTES;
  snprintf(ring->name, sizeof(ring->name), "%s", name);
  return wrap_ring(env, ring);
}

static napi_value write_chunk(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value args[2];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  if (argc < 2) return throw_error(env, "writeChunk", "expected ring and Buffer");
  svp_shm_ring_t *ring = unwrap_ring(env, args[0]);
  if (!ring) return NULL;
  bool is_buffer = false;
  napi_is_buffer(env, args[1], &is_buffer);
  if (!is_buffer) return throw_error(env, "writeChunk", "input must be a Buffer");
  uint8_t *input = NULL;
  size_t input_bytes = 0;
  napi_get_buffer_info(env, args[1], (void **)&input, &input_bytes);
  size_t consumed = 0;
  uint64_t frames_written = 0;
  const uint64_t frame_bytes = ring->header->frame_bytes;
  const uint64_t capacity = ring->header->capacity;
  while (consumed < input_bytes) {
    uint64_t write_sequence = atomic_load_explicit(&ring->header->write_sequence, memory_order_relaxed);
    uint64_t read_sequence = atomic_load_explicit(&ring->header->read_sequence, memory_order_acquire);
    if (!ring->partial_bytes && write_sequence - read_sequence >= capacity) break;
    uint8_t *slot = ring->frames + (write_sequence % capacity) * frame_bytes;
    size_t copy_bytes = input_bytes - consumed;
    size_t remaining = (size_t)frame_bytes - ring->partial_bytes;
    if (copy_bytes > remaining) copy_bytes = remaining;
    memcpy(slot + ring->partial_bytes, input + consumed, copy_bytes);
    ring->partial_bytes += copy_bytes;
    consumed += copy_bytes;
    if (ring->partial_bytes == frame_bytes) {
      atomic_store_explicit(&ring->header->write_sequence, write_sequence + 1, memory_order_release);
      ring->partial_bytes = 0;
      frames_written++;
    }
  }
  uint64_t write_sequence = atomic_load_explicit(&ring->header->write_sequence, memory_order_relaxed);
  uint64_t read_sequence = atomic_load_explicit(&ring->header->read_sequence, memory_order_acquire);
  napi_value result;
  napi_create_object(env, &result);
  set_number(env, result, "consumed", (double)consumed);
  set_number(env, result, "framesWritten", (double)frames_written);
  set_bool(env, result, "full", !ring->partial_bytes && write_sequence - read_sequence >= capacity);
  return result;
}

static napi_value read_frame_into(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value args[3];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  svp_shm_ring_t *ring = argc ? unwrap_ring(env, args[0]) : NULL;
  if (!ring) return NULL;
  uint64_t desired = 0;
  if (argc < 3 || !get_uint64(env, args[1], &desired)) {
    return throw_error(env, "readFrameInto", "invalid desired index");
  }
  bool is_buffer = false;
  napi_is_buffer(env, args[2], &is_buffer);
  if (!is_buffer) return throw_error(env, "readFrameInto", "output must be a Buffer");
  uint8_t *output = NULL;
  size_t output_bytes = 0;
  napi_get_buffer_info(env, args[2], (void **)&output, &output_bytes);
  if (output_bytes < ring->header->frame_bytes) {
    return throw_error(env, "readFrameInto", "output Buffer is smaller than one frame");
  }
  uint64_t read_sequence = atomic_load_explicit(&ring->header->read_sequence, memory_order_relaxed);
  uint64_t write_sequence = atomic_load_explicit(&ring->header->write_sequence, memory_order_acquire);
  double result = -1;
  if (read_sequence < write_sequence) {
    uint64_t selected = desired < read_sequence ? read_sequence : desired;
    if (selected >= write_sequence) selected = write_sequence - 1;
    if (selected > read_sequence) {
      atomic_fetch_add_explicit(&ring->header->skipped_frames, selected - read_sequence, memory_order_relaxed);
    }
    uint8_t *slot = ring->frames + (selected % ring->header->capacity) * ring->header->frame_bytes;
    memcpy(output, slot, (size_t)ring->header->frame_bytes);
    atomic_store_explicit(&ring->header->read_sequence, selected + 1, memory_order_release);
    result = (double)selected;
  }
  napi_value value;
  napi_create_double(env, result, &value);
  return value;
}

static napi_value discard_frames(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  svp_shm_ring_t *ring = argc ? unwrap_ring(env, args[0]) : NULL;
  if (!ring) return NULL;
  uint64_t write_sequence = atomic_load_explicit(&ring->header->write_sequence, memory_order_acquire);
  atomic_store_explicit(&ring->header->read_sequence, write_sequence, memory_order_release);
  napi_value result;
  napi_create_double(env, (double)write_sequence, &result);
  return result;
}

static napi_value get_stats(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  svp_shm_ring_t *ring = argc ? unwrap_ring(env, args[0]) : NULL;
  if (!ring) return NULL;
  uint64_t write_sequence = atomic_load_explicit(&ring->header->write_sequence, memory_order_acquire);
  uint64_t read_sequence = atomic_load_explicit(&ring->header->read_sequence, memory_order_acquire);
  napi_value result;
  napi_create_object(env, &result);
  set_number(env, result, "capacity", ring->header->capacity);
  set_bool(env, result, "closed", atomic_load_explicit(&ring->header->closed, memory_order_acquire) != 0);
  set_number(env, result, "frameBytes", (double)ring->header->frame_bytes);
  set_number(env, result, "queued", (double)(write_sequence - read_sequence));
  set_number(env, result, "readSequence", (double)read_sequence);
  set_number(env, result, "skippedFrames", (double)atomic_load_explicit(&ring->header->skipped_frames, memory_order_relaxed));
  set_number(env, result, "writeSequence", (double)write_sequence);
  return result;
}

static napi_value mark_closed(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  svp_shm_ring_t *ring = argc ? unwrap_ring(env, args[0]) : NULL;
  if (!ring) return NULL;
  atomic_store_explicit(&ring->header->closed, 1, memory_order_release);
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static napi_value close_ring_js(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value args[1];
  napi_get_cb_info(env, info, &argc, args, NULL, NULL);
  svp_shm_ring_t *ring = NULL;
  if (!argc || napi_unwrap(env, args[0], (void **)&ring) != napi_ok || !ring) {
    return throw_error(env, "closeRing", "invalid ring");
  }
  close_ring(ring);
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

static napi_value init(napi_env env, napi_value exports) {
  struct { const char *name; napi_callback callback; } functions[] = {
    { "closeRing", close_ring_js },
    { "createRing", create_ring },
    { "discardFrames", discard_frames },
    { "getStats", get_stats },
    { "markClosed", mark_closed },
    { "openRing", open_ring },
    { "readFrameInto", read_frame_into },
    { "writeChunk", write_chunk },
  };
  for (size_t index = 0; index < sizeof(functions) / sizeof(functions[0]); index++) {
    napi_value function;
    napi_create_function(env, functions[index].name, NAPI_AUTO_LENGTH, functions[index].callback, NULL, &function);
    napi_set_named_property(env, exports, functions[index].name, function);
  }
  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
