package main

import (
	"log"

	"github.com/leoluk/congruity/pkg/libinput"
	"golang.org/x/sys/unix"
)

const (
	testDevice = "/dev/input/event9"
)

func main() {
	li := libinput.NewPathContext()
	defer li.Close()

	if err := li.PathAddDevice(testDevice); err != nil {
		log.Fatal(err)
	}

	fd := li.GetPollFD()

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

	ev, err := li.GetEvent()
	if err != nil {
		log.Fatal(err)
	}

	log.Println("event: %+v", ev)
}
