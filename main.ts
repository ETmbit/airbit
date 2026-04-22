//% color=#0fbc11 icon="\uf1d8"
//% block="Airbit"
//% block.loc.nl="Airbit"
namespace Airbit {

    export let arm = 0          // 0 = stop, 1 = standby
    export let throttle = 0     // rotary speed: 0 ~ 100 %
    export let roll = 0         // -45 ~ 45 degr
    export let pitch = 0        // -45 ~ 45 degr
    export let yaw = 0          // -30 ~ 30 degr

    function clear() {
        Airbit.arm = 0
        Airbit.throttle = 0
        Airbit.roll = 0
        Airbit.pitch = 0
        Airbit.yaw = 0
    }

    //% block="turn the drone clockwise"
    //% block.loc.nl="draai de drone rechtsom"
    export function yawRight() {
        Airbit.roll = 30
    }

    //% block="turn the drone counterclockwise"
    //% block.loc.nl="draai de drone linksom"
    export function yawLeft() {
        Airbit.throttle = -30
    }

    //% block="move the drone to the right"
    //% block.loc.nl="beweeg de drone naar rechts"
    export function rollRight() {
        Airbit.roll = 30
    }

    //% block="move the drone to the left"
    //% block.loc.nl="beweeg de drone naar links"
    export function rollLeft() {
        Airbit.throttle = -30
    }

    //% block="move the drone backward"
    //% block.loc.nl="beweeg de drone achteruit"
    export function pitchBackward() {
        Airbit.pitch = -30
    }

    //% block="move the drone forward"
    //% block.loc.nl="beweeg de drone vooruit"
    export function pitchForward() {
        Airbit.pitch = 30
    }

    //% block="let the drone descend"
    //% block.loc.nl="laat de drone dalen"
    export function throttleDescend() {
        while (Airbit.throttle > 40) {
            Airbit.throttle -= 5
            basic.pause(100)
        }
    }

    //% block="let the drone ascend"
    //% block.loc.nl="laat de drone stijgen"
    export function throttleAscend() {
        while (Airbit.throttle < 100) {
            Airbit.throttle += 5
            basic.pause(100)
        }
    }

    //% block="let the drone hover still"
    //% block.loc.nl="laat de drone stil hangen"
    export function still() {
        Airbit.roll = 0
        Airbit.pitch = 0
        Airbit.yaw = 0
        while (Airbit.throttle > 70) {
            Airbit.throttle -= 5
            basic.pause(100)
        }
        while (Airbit.throttle < 70) {
            Airbit.throttle += 5
            basic.pause(100)
        }
    }

    //% block="let the drone take off"
    //% block.loc.nl="laat de drone opstijgen"
    export function takeOff() {
        Airbit.arm = 1
        throttleAscend()
        basic.pause(3000)
        still()
    }

    //% block="put the drone in stanby mode"
    //% block.loc.nl="zet de drone in standby"
    export function standby() {
        clear()
        Airbit.arm = 1
    }

    //% block="put the drone in stop mode"
    //% block.loc.nl="zet de drone uit"
    export function stop() {
        clear()
    }

    //% block="make an emergancy stop"
    //% block.loc.nl="maak een noodstop"
    export function emergancyStop() {
        clear()
    }
}

basic.forever(function () {
    radio.sendValue("A", Airbit.arm)
    radio.sendValue("T", Airbit.throttle)
    radio.sendValue("R", Airbit.roll)
    radio.sendValue("P", Airbit.pitch)
    radio.sendValue("Y", Airbit.yaw)
})
