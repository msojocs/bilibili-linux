package libinput

// Fedora: pkcon install libinput-devel systemd-devel

// https://github.com/dong-zeyu/x11-libinput-gestures/blob/956ec0e79d9d9f88b692ce552fb72bbdd37df994/main.cc

// #cgo pkg-config: libinput
// #include <libinput.h>
// #include <errno.h>
// #include <fcntl.h>
// #include <unistd.h>
//
// static int open_restricted(const char *path, int flags, void *data)
// {
//   int fd = open(path, flags);
//   return fd < 0 ? -errno : fd;
// }
//
// static void close_restricted(int fd, void *data)
// {
//   close(fd);
// }
//
// static struct libinput_interface simple_interface = {
//   .open_restricted = open_restricted,
//	 .close_restricted = close_restricted,
// };
//
// static struct libinput_interface* get_simple_interface()
// {
//   return &simple_interface;
// }
import "C"
import (
	"fmt"
	"runtime"
	"unsafe"

	"github.com/fstanis/screenresolution"
	"golang.org/x/sys/unix"
)

type Event struct {
	ev   *C.struct_libinput_event
	Type EventType
}
type Pointer struct {
	X float64
	Y float64
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__event.html#ga1df956c16e26cbbd911e553ec081022a
func (ev *Event) Destroy() {
	C.libinput_event_destroy(ev.ev)
}
func (ev *Event) GetAbsolutePosition() (Pointer, error) {
	resolution := screenresolution.GetPrimary()
	if resolution.String() == "" {
		return Pointer{}, fmt.Errorf("resolution error")
	}
	ptr := (*C.struct_libinput_event_pointer)(unsafe.Pointer(ev.ev))
	scale := GetScreenScale()
	w, h := uint32(float64(resolution.Width)/scale), uint32(float64(resolution.Height)/scale)
	x := C.libinput_event_pointer_get_absolute_x_transformed(ptr, C.uint32_t(w))
	y := C.libinput_event_pointer_get_absolute_y_transformed(ptr, C.uint32_t(h))
	p := Pointer{
		X: float64(x),
		Y: float64(y),
	}
	return p, nil
}

type PathContext struct {
	li *C.struct_libinput
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__base.html#ga363c6b6e47dcf410a3b3ebd5547c8b07
func NewPathContext() *PathContext {
	i := C.get_simple_interface()
	li := C.libinput_path_create_context(i, unsafe.Pointer(nil))
	if li == nil {
		panic("failed to call libinput_path_create_context")
	}

	return &PathContext{li: li}
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__base.html#ga7ed0797d23e34b650e0aeb98b5350309
func (li *PathContext) Close() {
	if ret := C.libinput_unref(li.li); ret != nil {
		panic("failed to call libinput_unref")
	}
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__base.html#gaa797496f0150b482a4e01376bd33a47b
func (li *PathContext) PathAddDevice(path string) error {
	p := C.CString(path)
	defer C.free(unsafe.Pointer(p))

	if ret := C.libinput_path_add_device(li.li, p); ret == nil {
		return fmt.Errorf("failed to add device: %s", path)
	}

	return nil
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__base.html#ga885a59371d4e8de0e18a2a2a66942e11
func (li *PathContext) GetPollFD() unix.PollFd {
	fd := C.libinput_get_fd(li.li)

	return unix.PollFd{
		Fd:      int32(fd),
		Events:  unix.POLLIN,
		Revents: 0,
	}
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__base.html#ga271f910ed17461830e48d4cd20483a00
func (li *PathContext) Dispatch() error {
	if errno := C.libinput_dispatch(li.li); errno != 0 {
		return fmt.Errorf("libinput_dispatch returned errno %d", errno)
	}

	return nil
}

// https://wayland.freedesktop.org/libinput/doc/latest/api/group__base.html#gacead6670eaecf7c807659e2b6c725630
func (li *PathContext) GetEvent() (*Event, error) {
	ev := C.libinput_get_event(li.li)
	if ev == nil {
		return nil, fmt.Errorf("failed to call libinput_get_event")
	}

	tt := C.libinput_event_get_type(ev)

	e := &Event{ev: ev, Type: EventType(tt)}
	runtime.SetFinalizer(e, func(e *Event) { e.Destroy() })

	return e, nil
}
