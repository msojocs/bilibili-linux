package main

import (
	"cursor-tool/libinput"
	"flag"
	"fmt"
	"log"
	"strings"
	"time"

	"golang.org/x/sys/unix"
)

var (
	devices = flag.String("devices", "", "evdev devices (comma-separated)")
)

func init() {
	flag.Parse()

	if *devices == "" {
		log.Fatal("please specify devices")
	}
}

func main() {

	li := libinput.NewPathContext()
	defer li.Close()

	ds := strings.Split(*devices, ",")
	for _, d := range ds {
		if err := li.PathAddDevice(d); err != nil {
			log.Fatal(err)
		}
	}

	// log.Println("start poll")
	fd := li.GetPollFD()

	for {
		// log.Println("please generate input")
		n, err := unix.Poll([]unix.PollFd{fd}, 1000)
		if err != nil {
			log.Fatal(err)
		}
		if err := li.Dispatch(); err != nil {
			log.Fatal(err)
		}

		if n <= 0 {
			log.Fatal("no events received")
		}
		// log.Println("ecent count:", n)

		ev, err := li.GetEvent()
		if err != nil {
			log.Fatal(err)
		}

		// log.Printf("event: %+v\n", ev)
		// log.Printf("type: %s\n", ev.Type)
		if ev.Type == libinput.Event_PointerMotionAbsolute {
			p, err := ev.GetAbsolutePosition()
			if err != nil {
				log.Fatalln("absolute position error:", err)
			}
			fmt.Printf("%d,%d\n", uint32(p.X), uint32(p.Y))
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
}
