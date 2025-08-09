package libinput

/*
#cgo linux  pkg-config: xrandr
#include <stdlib.h>
#include <X11/Xlib.h>
#include <X11/Xresource.h>

float get_screen_scale(Display *dpy) {
	Display* display = XOpenDisplay(NULL);
    if (!display) return 1.0;

    double scale = 1.0;
    XrmInitialize();
    char* resmgr = XResourceManagerString(display);

    if (resmgr) {
        XrmDatabase db = XrmGetStringDatabase(resmgr);
        if (db) {
            char* type;
            XrmValue value;

            // 尝试获取 Xft.dpi 值
            if (XrmGetResource(db, "Xft.dpi", "String", &type, &value)) {
                if (value.addr) {
                    double dpi = atof(value.addr);
                    if (dpi > 48) {  // 合理值检查
                        scale = dpi / 96.0;
                    }
                }
            }
            XrmDestroyDatabase(db);
        }
    }

    XCloseDisplay(display);
    return scale;
}
*/
import "C"

func GetScreenScale() float64 {
	dpy := C.XOpenDisplay(nil)
	if dpy == nil {
		return 1.0
	}
	defer C.XCloseDisplay(dpy)
	return float64(C.get_screen_scale(dpy))
}
