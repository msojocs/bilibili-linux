package libinput

import "fmt"

type EventType uint32

// https://code.woboq.org/qt5/include/libinput.h.html
const (
	Event_None EventType = 0

	Event_DeviceAdded   = 1
	Event_DeviceRemoved = 2

	Event_KeyboardKey = 300

	Event_PointerMotion         = 400
	Event_PointerMotionAbsolute = 401
	Event_PointerButton         = 402
	Event_PointerAxis           = 403

	Event_TouchDown   = 500
	Event_TouchUp     = 501
	Event_TouchMotion = 502
	Event_TouchCancel = 503
	Event_TouchFrame  = 504

	Event_TabletToolAxis      = 600
	Event_TabletToolProximity = 601
	Event_TabletToolTip       = 602
	Event_TabletToolButton    = 603

	Event_TabletPadButton = 700
	Event_TabletPadRing   = 701
	Event_TabletPadStrip  = 702

	Event_GestureSwipeBegin  = 800
	Event_GestureSwipeUpdate = 801
	Event_GestureSwipeEnd    = 802
	Event_GesturePinchBegin  = 803
	Event_GesturePinchUpdate = 804
	Event_GesturePinchEnd    = 805

	Event_SwitchToggle = 900
)

func (ev EventType) String() string {
	switch ev {
	case Event_None:
		return "LIBINPUT_EVENT_NONE"
	case Event_DeviceAdded:
		return "LIBINPUT_EVENT_DEVICE_ADDED"
	case Event_DeviceRemoved:
		return "LIBINPUT_EVENT_DEVICE_REMOVED"
	case Event_KeyboardKey:
		return "LIBINPUT_EVENT_KEYBOARD_KEY"
	case Event_PointerMotion:
		return "LIBINPUT_EVENT_POINTER_MOTION"
	case Event_PointerMotionAbsolute:
		return "LIBINPUT_EVENT_POINTER_MOTION_ABSOLUTE"
	case Event_PointerButton:
		return "LIBINPUT_EVENT_POINTER_BUTTON"
	case Event_PointerAxis:
		return "LIBINPUT_EVENT_POINTER_AXIS"
	case Event_TouchDown:
		return "LIBINPUT_EVENT_TOUCH_DOWN"
	case Event_TouchUp:
		return "LIBINPUT_EVENT_TOUCH_UP"
	case Event_TouchMotion:
		return "LIBINPUT_EVENT_TOUCH_MOTION"
	case Event_TouchCancel:
		return "LIBINPUT_EVENT_TOUCH_CANCEL"
	case Event_TouchFrame:
		return "LIBINPUT_EVENT_TOUCH_FRAME"
	case Event_TabletToolAxis:
		return "LIBINPUT_EVENT_TABLET_TOOL_AXIS"
	case Event_TabletToolProximity:
		return "LIBINPUT_EVENT_TABLET_TOOL_PROXIMITY"
	case Event_TabletToolTip:
		return "LIBINPUT_EVENT_TABLET_TOOL_TIP"
	case Event_TabletToolButton:
		return "LIBINPUT_EVENT_TABLET_TOOL_BUTTON"
	case Event_TabletPadButton:
		return "LIBINPUT_EVENT_TABLET_PAD_BUTTON"
	case Event_TabletPadRing:
		return "LIBINPUT_EVENT_TABLET_PAD_RING"
	case Event_TabletPadStrip:
		return "LIBINPUT_EVENT_TABLET_PAD_STRIP"
	case Event_GestureSwipeBegin:
		return "LIBINPUT_EVENT_GESTURE_SWIPE_BEGIN"
	case Event_GestureSwipeUpdate:
		return "LIBINPUT_EVENT_GESTURE_SWIPE_UPDATE"
	case Event_GestureSwipeEnd:
		return "LIBINPUT_EVENT_GESTURE_SWIPE_END"
	case Event_GesturePinchBegin:
		return "LIBINPUT_EVENT_GESTURE_PINCH_BEGIN"
	case Event_GesturePinchUpdate:
		return "LIBINPUT_EVENT_GESTURE_PINCH_UPDATE"
	case Event_GesturePinchEnd:
		return "LIBINPUT_EVENT_GESTURE_PINCH_END"
	case Event_SwitchToggle:
		return "LIBINPUT_EVENT_SWITCH_TOGGLE"
	default:
		panic(fmt.Sprintf("unknown event type: %v", ev))
	}
}

type PointerAxis uint32

const (
	PointerAxis_ScrollVertical = iota
	PointerAxis_ScrollHorizontal
)

func (pp PointerAxis) String() string {
	switch pp {
	case PointerAxis_ScrollVertical:
		return "LIBINPUT_POINTER_AXIS_SCROLL_VERTICAL"
	case PointerAxis_ScrollHorizontal:
		return "LIBINPUT_POINTER_AXIS_SCROLL_HORIZONTAL"
	default:
		panic(fmt.Sprintf("unknown pointer axis: %v", pp))
	}
}
