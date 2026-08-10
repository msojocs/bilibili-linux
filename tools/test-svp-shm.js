const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const path = require('node:path')

if (process.platform !== 'linux') {
  console.log('svp-shm: skipped (POSIX shared memory is Linux-only)')
  process.exit(0)
}

const addonPath = path.resolve(__dirname, '../native/svp-shm/build/Release/svp_shm.node')
const shm = require(addonPath)
const name = `/bilibili-svp-test-${process.pid}-${Date.now()}`
const producer = shm.createRing(name, 8, 2)

try {
  const first = shm.writeChunk(producer, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13, 14]))
  assert.deepEqual(first, { consumed: 12, framesWritten: 1, full: false })
  const secondInput = Buffer.from([15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28])
  const second = shm.writeChunk(producer, secondInput)
  assert.deepEqual(second, { consumed: 4, framesWritten: 1, full: true })

  const childScript = `
    const assert = require('node:assert/strict')
    const shm = require(${JSON.stringify(addonPath)})
    const ring = shm.openRing(${JSON.stringify(name)})
    const output = Buffer.alloc(8)
    const firstIndex = shm.readFrameInto(ring, 0, output)
    assert.equal(firstIndex, 0)
    assert.deepEqual([...output], [1, 2, 3, 4, 5, 6, 7, 8])
    shm.closeRing(ring)
  `
  const child = spawnSync(process.execPath, ['-e', childScript], { encoding: 'utf8' })
  assert.equal(child.status, 0, child.stderr)

  assert.equal(shm.getStats(producer).readSequence, 1)
  const third = shm.writeChunk(producer, secondInput.subarray(second.consumed))
  assert.deepEqual(third, { consumed: 8, framesWritten: 1, full: true })

  const consumer = shm.openRing(name)
  try {
    const output = Buffer.alloc(8)
    const selected = shm.readFrameInto(consumer, 2, output)
    assert.equal(selected, 2)
    assert.deepEqual([...output], [21, 22, 23, 24, 25, 26, 27, 28])
    assert.equal(shm.getStats(consumer).skippedFrames, 1)
    assert.equal(shm.readFrameInto(consumer, 3, output), -1)
    shm.markClosed(producer)
    assert.equal(shm.getStats(consumer).closed, true)
  } finally {
    shm.closeRing(consumer)
  }
} finally {
  shm.closeRing(producer)
}

const capacityName = `/bilibili-svp-test-${process.pid}-${Date.now()}-capacity`
const capacityRing = shm.createRing(capacityName, 8, 512)
try {
  assert.equal(shm.getStats(capacityRing).capacity, 512)
  assert.deepEqual(shm.writeChunk(capacityRing, Buffer.alloc(24, 7)), { consumed: 24, framesWritten: 3, full: false })
  assert.equal(shm.discardFrames(capacityRing), 3)
  assert.equal(shm.getStats(capacityRing).queued, 0)
} finally {
  shm.closeRing(capacityRing)
}
assert.throws(
  () => shm.createRing(`${capacityName}-invalid`, 8, 513),
  /invalid name, frame size or capacity/,
)

console.log('svp-shm: lifecycle, backpressure and cross-process mapping passed')
