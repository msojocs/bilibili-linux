package main

import (
	"cursor-tool/libinput"
	"log"
	"time"

	"golang.org/x/sys/unix"
)

const (
	testDevice = "/dev/input/event2"
)

func main() {

	li := libinput.NewPathContext()
	defer li.Close()

	log.Println("start add device")
	if err := li.PathAddDevice(testDevice); err != nil {
		log.Fatal(err)
	}

	log.Println("start poll")
	fd := li.GetPollFD()

	for {
		log.Println("please generate input")
		n, err := unix.Poll([]unix.PollFd{fd}, 10000)
		if err != nil {
			log.Fatal(err)
		}
		if err := li.Dispatch(); err != nil {
			log.Fatal(err)
		}

		if n <= 0 {
			log.Fatal("no events received")
		}
		log.Println("ecent count:", n)

		ev, err := li.GetEvent()
		if err != nil {
			log.Fatal(err)
		}

		log.Printf("event: %+v\n", ev)
		log.Printf("type: %s\n", ev.Type)
		if ev.Type == libinput.Event_PointerMotionAbsolute {
			p, err := ev.GetAbsolutePosition()
			if err != nil {
				log.Fatalln("absolute position error:", err)
			}
			log.Println("x:", p.X, ", y:", p.Y)
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
}
