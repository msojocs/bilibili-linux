package libinput

/*
#cgo linux  pkg-config: xrandr
#include <stdlib.h>
#include <X11/Xlib.h>
#include <X11/extensions/Xrandr.h>

float get_screen_scale(Display *dpy) {
    int event_base, error_base;
    if (!XRRQueryExtension(dpy, &event_base, &error_base)) {
        return 1.0; // Xrandr extension not available
    }

    int screen = DefaultScreen(dpy);
    XRRScreenResources *res = XRRGetScreenResources(dpy, RootWindow(dpy, screen));
    if (!res) {
        return 1.0;
    }

    XRROutputInfo *output_info = NULL;
    for (int i = 0; i < res->noutput; ++i) {
        output_info = XRRGetOutputInfo(dpy, res, res->outputs[i]);
        if (output_info && output_info->connection == RR_Connected) {
            break;
        }
        XRRFreeOutputInfo(output_info);
        output_info = NULL;
    }

    if (!output_info) {
        XRRFreeScreenResources(res);
        return 1.0;
    }

    float scale = 1.0;
    if (output_info->crtc) {
        XRRCrtcInfo *crtc_info = XRRGetCrtcInfo(dpy, res, output_info->crtc);
        if (crtc_info) {
            scale = (float)crtc_info->width / (float)output_info->mm_width;
            XRRFreeCrtcInfo(crtc_info);
        }
    }

    XRRFreeOutputInfo(output_info);
    XRRFreeScreenResources(res);
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
