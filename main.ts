/*
File:       github.com/ETmbit/airbit.ts
Version:	2026-1
Copyright:  ElecTricks, 2026
License:    GNU GPL 3 or later
Disclaimer: Distributed without any warranty
Depends on: None
*/

//////////////////
//  INCLUDE     //
//  etradio.ts  //
//////////////////

// the micro:bit radio buffer size is 19 bytes only
// therefore, messages are sent in chunks
// a sender sends the chunks with format: id|ix|chunk
// the final chunk has a unique ack_id: id|-1|ack_id
// a receiver acknowledges with: id|-2|ack_id

//##### GROUP HANDLING #####\\

const ET_EVENT = 200 + Math.randomRange(0, 100) // semi-unique id

let ETgroup = 1
let ETgroupTimer = 0
let ETgroupSet = false
let ETgroupHandlers: ((group: number) => void)[] = []

function etHandleGroup() {
    basic.showNumber(ETgroup)
    if (ETgroupHandlers.length) {
        for (let ix = 0; ix < ETgroupHandlers.length; ix++)
            ETgroupHandlers[ix](ETgroup)
    }
    else
        basic.showIcon(IconNames.Yes)
}

control.onEvent(ET_EVENT, 0, function () {
    while (ETgroupTimer > control.millis()) { basic.pause(1) }
    etHandleGroup()
    ETgroupTimer = 0
    ETgroupSet = false
})

input.onLogoEvent(TouchButtonEvent.Pressed, function () {
    if (ETgroupSet) {
        ETgroup++
        if (ETgroup > 9) ETgroup = 1
        radio.setGroup(ETgroup)
    }
    else
        ETgroupSet = true
    basic.showNumber(ETgroup)
    if (!ETgroupTimer) {
        ETgroupTimer = control.millis() + 1000
        control.raiseEvent(ET_EVENT, 0)
    }
    else
        ETgroupTimer = control.millis() + 1000
})

//##### DATA HANDLING #####\\

const ET_EOM = -1
const ET_ACK = -2

interface ETradioMessages {
	sent:     string[]  // id's of sent messages that have no ACK yet
	received: string[]	// received messages that have not been read yet
	chunks:   string[]	// temporary buffer for received chunks
	handler:  (message: string) => void // will be called when a radio message is received
}

let ETradioMsg: { [id: string]: ETradioMessages } = {}
let ETradioTime = 0

radio.onReceivedString(function (chunk: string) {

    ETradioTime = input.runningTime()

	let parts = chunk.split("|")
	if (parts.length != 3) return
	let id = parts[0]
	let ix = +parts[1]
	let msg = parts[2]

	// create a buffer for id if not existing
	etradio.createBuffer(id)

	// EOM handling (receiver side)
	// (1) send ACK
	// (2) store message or call handler
	// see: etradio.send()
	if (ix === ET_EOM) {
		// (1) msg contains msg id
		msg = id + "|" + ET_ACK.toString() + "|" + msg
		radio.sendString(msg)
		// (2)
		msg = ETradioMsg[id].chunks.join("")
		if (ETradioMsg[id].handler)
			ETradioMsg[id].handler(msg)
		else
			ETradioMsg[id].received.push(msg)
		ETradioMsg[id].chunks = []
		return
	}

	// ACK handling (sender side)
	// (1) clear the ACK flag when acknowledged
	// see: etradio.send()
	if (ix === ET_ACK) {
        if (ETradioMsg[id] && ((ix = ETradioMsg[id].sent.indexOf(msg)) >= 0))
            // (1)
            ETradioMsg[id].sent.splice(ix, 1)
		return
	}

	// CHUNK handling (receiver side)
    ETradioMsg[id].chunks[ix] = msg
})

namespace etradio {

	export function createBuffer(id: string) {
		if (!ETradioMsg[id])
			ETradioMsg[id] = {sent: [], received: [], chunks: [], handler: null}
	}

	export function clearBuffer(id: string) {
		if (ETradioMsg[id])
			delete ETradioMsg[id]
	}

	export function send(id: string, msg: string, timeout: number = 0) {
		// messages are broadcasted

		let len = Math.max(1, 15 - id.length)
		let ix = 0
		let chunk = ""
        let ack_id = control.millis().toString() + Math.randomRange(0, 999).toString()
        ack_id = ack_id.substr(0, len)

		// create a buffer for id if not existing
		createBuffer(id)

		// send message in chunks
		while (msg.length > 0) {
			chunk = id + "|" + ix.toString() + "|" + msg.substr(0, len)
			msg = msg.substr(len)
			radio.sendString(chunk)
			basic.pause(1)
            ix += 1
		}

		// (1) raise ACK flag
		// (2) sent ack_id so that receiver can ACK
		// (3) wait for ACK flag being cleared by radio.onReceivedString
		// (4) clear ACK flag in case of timeout
		// Not fully fail save, but best in terms of successfull transmission
		// Timeout is the savety net
		// After timeout clear the ACK flag anyway

		// (1)
		ETradioMsg[id].sent.push(ack_id)

		// (2)
		chunk = id + "|" + ET_EOM.toString() + "|" + ack_id
		radio.sendString(chunk)

		// (3)
		let tm = control.millis() + timeout
		while (control.millis() < tm && ETradioMsg[id].sent.indexOf(ack_id) >= 0)
			basic.pause(1)

		// (4)
		if ((ix = ETradioMsg[id].sent.indexOf(ack_id)) >= 0)
			ETradioMsg[id].sent.splice(ix, 1)
	}

	export function available(id: string) : boolean {
		return !!(ETradioMsg[id] && (ETradioMsg[id].received.length > 0))
	}

	export function read(id: string) : string {
		if (!ETradioMsg[id] || !ETradioMsg[id].received.length)
			return ""
		let msg = ETradioMsg[id].received.shift()
		return msg
	}

    export function ellapsed() : number{
        return input.runningTime() - ETradioTime
    }

	export function registerMessageHandler(id: string, handler: (msg: string) => void) {
		createBuffer(id)
		ETradioMsg[id].handler = handler
	}

	export function registerGroupHandler(handler: (group: number) => void) {
        ETgroupHandlers.push(handler)
	}
}

///////////////////
//  END INCLUDE  //
///////////////////

////////////////////////////
//  INCLUDE               //
//  pitouchbit-shared.ts  //
////////////////////////////

enum ETtouchButton {
    //% block="left"
    //% block.loc.nl="linker"
    Left,
    //% block="a-"
    //% block.loc.nl="a-"
    A,
    //% block="b-"
    //% block.loc.nl="b-"
    B,
    //% block="c-"
    //% block.loc.nl="c-"
    C,
    //% block="d-"
    //% block.loc.nl="d-"
    D,
    //% block="right"
    //% block.loc.nl="rechter"
    Right,
}

enum ETtouchEvent {
    //% block="released"
    //% block.loc.nl="losgelaten"
    Released,
    //% block="pressed"
    //% block.loc.nl="aangeraakt"
    Pressed,
}

/////////////////
// END INCLUDE //
/////////////////

///////////////////
//  INCLUDE      //
//  ettiltpad.ts //
///////////////////

// the next constants agree with 'et-tiltpad-app.ts'

const ET_TILTPADID = "TP"

const ETTILT = "T"
const ETBUTTON = "B"

enum ETtilt {
    //% block="pitch"
    //% block.loc.nl="pitch"
    Pitch,
    //% block="roll"
    //% block.loc.nl="roll"
    Roll,
    //% block="yaw"
    //% block.loc.nl="yaw"
    Yaw,
}

function etTiltpadRadio(msg: string) {
    let parts = msg.split(";")
    if (parts.length != 3) return
    let num = +parts[0]
    let prm = parts[1]
    let val = +parts[2]
    EtTiltpad.handleTilt(num, prm, val)
}
etradio.registerMessageHandler(ET_TILTPADID, etTiltpadRadio)

//% color="#C4C80E" icon="\uf065"
//% block="Tiltpad"
//% block.loc.nl="Tiltpad"
namespace EtTiltpad {

	interface itilt {
		pitch: number
		roll: number
		yaw: number
	}

    let onTiltHandler: (() => void)[] = []
    let onLeftHandler: (() => void)[] = []
    let onRightHandler: (() => void)[] = []
    let onAHandler: (() => void)[] = []
    let onBHandler: (() => void)[] = []
    let onCHandler: (() => void)[] = []
    let onDHandler: (() => void)[] = []
    let onReleasedHandler: (() => void)[] = []

    let tilt: itilt[] = []

    onTiltHandler.push(null)
    onLeftHandler.push(null)
    onRightHandler.push(null)
    onAHandler.push(null)
    onBHandler.push(null)
    onCHandler.push(null)
    onDHandler.push(null)
    onReleasedHandler.push(null)

    tilt.push({pitch:999, roll:999, yaw:999})

    export function handleTilt(num: number, prm: string, val: number) {
        if (num < 0) return
        if (prm == ETTILT) {
			let parts = prm.split("|")
			if (parts.length != 3) return
            if (num < tilt.length)
                tilt[num] = {pitch: +parts[0], roll: +parts[1], yaw: +parts[2]}
            if ((num < onTiltHandler.length) && onTiltHandler[num])
                onTiltHandler[num]()
        }
        else
        if (prm == ETBUTTON) {
            if (val > 5) {
                if ((num < onReleasedHandler.length) && onReleasedHandler[num])
                    onReleasedHandler[num]()
                return
            }
            switch (val) {
                case ETtouchButton.Left:
                    if ((num < onLeftHandler.length) && onLeftHandler[num])
                        onLeftHandler[num]()
                    break
                case ETtouchButton.Right:
                    if ((num < onRightHandler.length) && onRightHandler[num])
                        onRightHandler[num]()
                    break
                case ETtouchButton.A:
                    if ((num < onAHandler.length) && onAHandler[num])
                        onAHandler[num]()
                    break
                case ETtouchButton.B:
                    if ((num < onBHandler.length) && onBHandler[num])
                        onBHandler[num]()
                    break
                case ETtouchButton.C:
                    if ((num < onCHandler.length) && onCHandler[num])
                        onCHandler[num]()
                    break
                case ETtouchButton.D:
                    if ((num < onDHandler.length) && onDHandler[num])
                        onDHandler[num]()
                    break
            }
        }
    }

    //% color="#802080"
    //% block="when a button is released"
    //% block.loc.nl="wanneer een knop wordt losgelaten"
    export function onButtonReleased(code: () => void): void {
        onTiltpadButtonReleased(1, code)
    }

    //% color="#802080"
    //% block="when button %but is touched"
    //% block.loc.nl="wanneer de %but knop wordt aangeraakt"
    export function onButton(but: ETtouchButton, code: () => void): void {
        onTiltpadButton(but, 1, code)
    }

    //% color="#802080"
    //% block="when the tilt changes"
    //% block.loc.nl="wanneer de tilt wijzigt"
    export function onTilt(code: () => void): void {
        onTiltpadTilt(1, code)
    }

    //% block="pitch"
    //% block.loc.nl="pitch"
    export function readPitch(): number {
        if (tilt.length) return tilt[0].pitch
        return 999
    }

    //% block="roll"
    //% block.loc.nl="roll"
    export function readRoll(): number {
        if (tilt.length) return tilt[0].roll
        return 999
    }

    //% block="yaw"
    //% block.loc.nl="yaw"
    export function readYaw(): number {
        if (tilt.length) return tilt[0].yaw
        return 999
    }

    //% subcategory="Meerdere pads"
    //% color="#802080"
    //% block="when a button is released"
    //% block.loc.nl="wanneer een knop wordt losgelaten"
    //% num.min=1 num.max=10
    export function onTiltpadButtonReleased(num: number, code: () => void): void {
        num -= 1
        if (num >= 0 && num < onReleasedHandler.length)
            onReleasedHandler[num] = code
    }

    //% subcategory="Meerdere pads"
    //% color="#802080"
    //% block="when button %but of touchpad %num is touched"
    //% block.loc.nl="wanneer de %but knop van tiltpad %num wordt aangeraakt"
    //% num.min=1 num.max=10
    export function onTiltpadButton(but: ETtouchButton, num: number, code: () => void): void {
        num -= 1
        if (num < 0) return
        switch (but) {
            case ETtouchButton.Left:
                if (onLeftHandler.length > num) onLeftHandler[num] = code
                break
            case ETtouchButton.A:
                if (onAHandler.length > num) onAHandler[num] = code;
                break
            case ETtouchButton.B:
                if (onBHandler.length > num) onBHandler[num] = code
                break
            case ETtouchButton.C:
                if (onCHandler.length > num) onCHandler[num] = code
                break
            case ETtouchButton.D:
                if (onDHandler.length > num) onDHandler[num] = code
                break
            case ETtouchButton.Right:
                if (onRightHandler.length > num) onRightHandler[num] = code
                break
        }
    }

    //% subcategory="Meerdere pads"
    //% color="#802080"
    //% block="when the tilt of tiltpad %num changes"
    //% block.loc.nl="wanneer de tilt van tiltpad %num wijzigt"
    //% num.min=1 num.max=10
    export function onTiltpadTilt(num: number, code: () => void): void {
        num -= 1
        if (num < 0) return
        if (onTiltHandler.length > num) onTiltHandler[num] = code
    }

    //% subcategory="Meerdere pads"
    //% block="pitch of tiltpad %num"
    //% block.loc.nl="pitch van tiltpad %num"
    export function readTiltpadPitch(num: number): number {
        num -= 1
        if (num >= 0 && num < tilt.length)
            return tilt[num].pitch
        return 999
    }

    //% subcategory="Meerdere pads"
    //% block="roll of tiltpad %num"
    //% block.loc.nl="roll van tiltpad %num"
    export function readTiltpadRoll(num: number): number {
        num -= 1
        if (num >= 0 && num < tilt.length)
            return tilt[num].roll
        return 999
    }

    //% subcategory="Meerdere pads"
    //% block="yaw of tiltpad %num"
    //% block.loc.nl="yaw van tiltpad %num"
    export function readTiltpadYaw(num: number): number {
        num -= 1
        if (num >= 0 && num < tilt.length)
            return tilt[num].yaw
        return 999
    }

    //% subcategory="Meerdere pads"
    //% block="use %cnt tiltpads"
    //% block.loc.nl="gebruik %cnt tiltpads"
    //% cnt.min=1 cnt.max=10 cnt.defl=2
    export function setTiltpadCount(cnt: number) {

        if (cnt < 1) cnt = 1

        onTiltHandler.splice(0, onTiltHandler.length)
        onLeftHandler.splice(0, onLeftHandler.length)
        onRightHandler.splice(0, onRightHandler.length)
        onAHandler.splice(0, onAHandler.length)
        onBHandler.splice(0, onBHandler.length)
        onCHandler.splice(0, onCHandler.length)
        onDHandler.splice(0, onDHandler.length)

        for (let i = 0; i < cnt; i++) {
            onTiltHandler.push(null)
            onLeftHandler.push(null)
            onRightHandler.push(null)
            onAHandler.push(null)
            onBHandler.push(null)
            onCHandler.push(null)
            onDHandler.push(null)

            tilt.push({pitch: 999, roll: 999, yaw: 999})
        }
    }
}

/////////////////
// END INCLUDE //
/////////////////

/////////////////
//  INCLUDE    //
//  airbit.ts  //
/////////////////

namespace AirBit {

    let radioReceivedTime = 0   // used to check radio connection
    let fusionTime = 0

    let screenMode = 0

    let mVoltBattery = 3700
    let chargingSwitch = 0
    let notCharging = true
    let batteryLev = 0
    const BATT_FACTOR = 5.94

    let motorA = 0
    let motorB = 0
    let motorC = 0
    let motorD = 0

    let motorSpeed = -1

    let stable = true  // upside down emergency stop

    let gyroExists = false
    let mcExists = false

    let throttleScaled = 0

    let throttle = 0
    let arm = 0
    let pitch = 0
    let roll = 0
    let yaw = 0

    let imuPitch = 0
    let imuRoll = 0
    let imuYaw = 0

    let yawP = 5
    let yawD = 70

    let pitchCorrection = 0
    let rollCorrection = 0
    let yawCorrection = 0

    let pitchDiff = 0
    let rollDiff = 0
    let yawDiff = 0

    let lastPitchDiff = 0
    let lastRollDiff = 0
    let lastYawDiff = 0

    let pitchDdiff = 0
    let rollDdiff = 0
    let yawDdiff = 0

    let pitchIdiff = 0
    let rollIdiff = 0

    const ROLLPITCH_P = 0.5 // was 0.9
    const ROLLPITCH_I = 0 // was 0.004
    const ROLLPITCH_D = 15 // was 15

    let accPitch = 0
    let accRoll = 0

    let accPitchOffset = 0
    let accRollOffset = 0

    let accX = 0
    let accY = 0
    let accZ = 0

    let gyroX = 0
    let gyroY = 0
    let gyroZ = 0

    let gyroXdelta = 0
    let gyroYdelta = 0
    let gyroZdelta = 0

    let gyroXcalibration = 0
    let gyroYcalibration = 0
    let gyroZcalibration = 0

    let PCA_REG_LEDUOT = 8
    let PCA_REG_SLAVEADR = 98
    let PCA_REG_MODE1 = 0
    let PCA_REG_MODE2 = 1
    let PCA_REG_MODE2_CONFIG = 5

    let IMU_REG_CONFIG = 1
    let IMU_PWR_MGMT_1 = 107
    let IMU_WHO_AM_I = 117
    let IMU_SIGNAL_PATH_RESET = 105
    let IMU_USER_CTRL = 106
    let IMU_ACCEL_CONFIG_2 = 29
    let IMU_REG_ADDRESS = 104

    let BARO_REG_SLAVEADR = 99

    let PCA_pwm0 = 2
    let PCA_pwm1 = 3
    let PCA_pwm2 = 4
    let PCA_pwm3 = 5

    /**
     * Drone start up
     */

    radio.setGroup(7)
    basic.showNumber(7)

    startupBatteryCheck()
    basic.pause(1000)

    i2crr.setI2CPins(DigitalPin.P2, DigitalPin.P1)

    basic.pause(100)
    imuStart()
    basic.pause(100)
    pcaStart()

    while (mcExists == false) {
        pcaStart()
        basic.showString("Connect battery", 100)
    }

    imuCalibrate()

    while (arm)
        basic.showString("Disarm!")

    // MAIN LOOP
    basic.forever(function () {
        // Read raw data from gyro and accelerometer
        imuRead()
        // Calculate absolute Roll, Pitch and Yaw angles by fusion of gyro and accelerometer together.
        imuFusion()
        basic.pause(1)
        lostSignalCheck()

        // The "magic" algorithm that stabilises the drone based on setpoint angle and actual angle,
        // finding the difference and changing motor speed to compensate.
        stabilisePid()

        // If upside down while armed, disable flying
        if (Math.abs(imuRoll) > 90) {
            stable = false
        } else {
            stable = true
        }
        // Only start motors if armed, stable, motor controller and gyro is operating
        if (arm && stable && (mcExists && (gyroExists && notCharging))) {
            if (throttle == 0) {
                // Idle speed of motors
                MotorSpeed(5, 5, 5, 5)
            } else {
                MotorSpeed(motorA, motorB, motorC, motorD)
            }
        } else {
            // Clear registers for error compensation algorithms.
            // Do not keep errors from past flight.
            cleanReg()
            MotorSpeed(0, 0, 0, 0)
        }
    })

    basic.forever(function () {
        mVoltBattery = Math.round(pins.analogReadPin(AnalogPin.P0) * BATT_FACTOR * 0.1 + mVoltBattery * 0.9)
    })

    basic.forever(function () {
        if (stable == false && arm) {
            basic.showString("Tilted. Please reset.")
        }
        else
            if (mVoltBattery > 3400) {
                screen()
            }
            else
                if (mVoltBattery > 3350) {
                    batteryIcon(1)
                }
                else {
                    // flash empty battery
                    basic.clearScreen()
                    batteryIcon(0)
                    basic.pause(1000)
                    basic.clearScreen()
                    basic.pause(1000)
                }
    })

    /**
    * Draw a vertical bar with gradients for prescicion
    * X = 0..4 x position on screen, amount = 0..100
    */
    export function drawBar(x: number, amount: number) {
        for (let index = 0; index <= amount / 20; index++) {
            led.plot(x, 4 - index)
        }
        led.plotBrightness(x, 4 - Math.floor(amount / 20), 12.75 * (amount % 20))
    }

    export function cleanReg() {
        rollDiff = 0
        pitchDiff = 0
        lastRollDiff = 0
        lastPitchDiff = 0
        lastYawDiff = 0
        rollIdiff = 0
        pitchIdiff = 0
        yawDiff = 0
        yawDdiff = 0
        lastRollDiff = 0
        lastPitchDiff = 0

        pitchDdiff = 0
        rollDdiff = 0
        imuYaw = 0
        gyroZdelta = 0
        yaw = 0
        rollCorrection = 0
        pitchCorrection = 0

    }

    export function MotorSpeed(m0: number, m1: number, m2: number, m3: number) {
        pins.i2cWriteNumber(
            PCA_REG_SLAVEADR,
            PCA_pwm0 << 8 | m3,
            NumberFormat.UInt16BE,
            false
        )
        pins.i2cWriteNumber(
            PCA_REG_SLAVEADR,
            PCA_pwm1 << 8 | m2,
            NumberFormat.UInt16BE,
            false
        )
        pins.i2cWriteNumber(
            PCA_REG_SLAVEADR,
            PCA_pwm2 << 8 | m1,
            NumberFormat.UInt16BE,
            false
        )
        pins.i2cWriteNumber(
            PCA_REG_SLAVEADR,
            PCA_pwm3 << 8 | m0,
            NumberFormat.UInt16BE,
            false
        )
    }

    export function baroStart() {
        // Soft reset
        pins.i2cWriteNumber(
            BARO_REG_SLAVEADR,
            32861,
            NumberFormat.UInt16BE,
            true
        )
        basic.pause(10)
        pins.i2cWriteNumber(
            BARO_REG_SLAVEADR,
            61384,
            NumberFormat.UInt16BE,
            true
        )
        let ret = pins.i2cReadNumber(BARO_REG_SLAVEADR, NumberFormat.UInt16LE, true)
        if (ret) {
            basic.showString("B")
        } else {
            basic.showString("NB")
        }
    }

    export function imuStart() {
        // Full reset chip (H_RESET, internal 20MHz clock)
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_PWR_MGMT_1 << 8 | 0x80,
            NumberFormat.UInt16BE,
            false
        )
        basic.pause(500)
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_WHO_AM_I,
            NumberFormat.UInt8BE,
            true
        )
        let id = pins.i2cReadNumber(IMU_REG_ADDRESS, NumberFormat.Int16BE, false)
        // basic.showNumber(IMU_Return >> 8)
        basic.clearScreen()
        if (id >> 8 > 0) {
            basic.showString("G")
            gyroExists = true
        } else {
            basic.showString("NG", 50)
            gyroExists = false
        }
        // set clock to internal PLL
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_PWR_MGMT_1 << 8 | 0x01,
            NumberFormat.UInt16BE,
            false
        )
        // // place accel and gyro on standby
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_SIGNAL_PATH_RESET << 8 | 0x07,
            NumberFormat.UInt16BE,
            false
        )
        // disable fifo
        // was 0x01, FIFO only available for serial
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_USER_CTRL << 8 | 0x00,
            NumberFormat.UInt16BE,
            false
        )
        // disable fifo
        // Filter setting: DLP_CFG = 0(250 Hz), 1(176 Hz)
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_USER_CTRL << 8 | 0x00,
            NumberFormat.UInt16BE,
            false
        )
        // Gyro filter setting to 0 (250 Hz), 1 (176 Hz),  2 (92 Hz), 3 (41 Hz)
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_REG_CONFIG << 8 | 0,
            NumberFormat.UInt16BE,
            false
        )
        // Acc filter setting to 3 (44.8 Hz), 4 (21,2 Hz), 5 (10.2 Hz)
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            IMU_ACCEL_CONFIG_2 << 8 | 5,
            NumberFormat.UInt16BE,
            false
        )
    }

    export function imuCalibrate() {
        gyroXcalibration = 0
        gyroYcalibration =
        gyroZcalibration = 0
        let steadyCount = 0
        let filterShake = 0
        let filterDelta = 0
        let oldFilterDelta = 0
        basic.showString("C")
        imuRead()
        imuFusion()

        while (Math.abs(accRoll) > 2 || Math.abs(accPitch) > 2) {
            imuRead()
            imuFusion()
            basic.showString("Lay flat", 100)

        }

        while (steadyCount < 100) {
            imuRead()
            filterDelta = input.acceleration(Dimension.Strength) - oldFilterDelta
            oldFilterDelta = input.acceleration(Dimension.Strength)
            filterShake = Math.abs(filterDelta) * 0.1 + filterShake * 0.9
            //serial.writeValue("x", filterShake)
            accPitch = -57.295 * Math.atan2(accY, accZ)
            accRoll = -57.295 * Math.atan2(accX, accZ)
            basic.clearScreen()

            for (let i = 0; i < steadyCount / 20; i++) {
                // led.plot(i,0)   
                // led.plot(i,4) 
                led.plot(0, 4 - i)
                led.plot(4, 4 - i)
            }
            led.plot(accRoll / 4 + 2.5, -accPitch / 4 + 2.5)
            led.plot(accRoll / 4 + 3.5, -accPitch / 4 + 2.5)
            led.plot(accRoll / 4 + 1.5, -accPitch / 4 + 2.5)
            led.plot(accRoll / 4 + 2.5, -accPitch / 4 + 1.5)
            led.plot(accRoll / 4 + 2.5, -accPitch / 4 + 3.5)

            if (Math.abs(accRoll) < 2 && Math.abs(accPitch) < 2 && filterShake < 10) {
                steadyCount += 1
            } else {
                steadyCount = 0
            }
            basic.pause(20)
        }

        for (let index = 0; index < 100; index++) {
            imuRead()
            gyroXcalibration += gyroX
            gyroYcalibration += gyroY
            gyroZcalibration += gyroZ
            basic.pause(5)
        }
        gyroXcalibration = gyroXcalibration / 100
        gyroYcalibration = gyroYcalibration / 100
        gyroZcalibration = gyroZcalibration / 100
        accPitch = -57.295 * Math.atan2(accY, accZ)
        accRoll = -57.295 * Math.atan2(accX, accZ)
        accPitchOffset = accPitch
        accRollOffset = accRoll

        basic.showIcon(IconNames.Yes)
    }

    export function imuRead() {
        pins.i2cWriteNumber(
            IMU_REG_ADDRESS,
            67,
            NumberFormat.Int8LE,
            true
        )
        gyroX = pins.i2cReadNumber(104, NumberFormat.Int16BE, true)
        gyroY = pins.i2cReadNumber(104, NumberFormat.Int16BE, true)
        gyroZ = pins.i2cReadNumber(104, NumberFormat.Int16BE, false)
        pins.i2cWriteNumber(
            104,
            59,
            NumberFormat.Int8LE,
            true
        )
        accX = pins.i2cReadNumber(104, NumberFormat.Int16BE, true)
        accY = pins.i2cReadNumber(104, NumberFormat.Int16BE, true)
        accZ = pins.i2cReadNumber(104, NumberFormat.Int16BE, false)
    }

   export function imuFusion() {
        let looptime = input.runningTime() - fusionTime
        fusionTime = input.runningTime()
        accPitch = (-57.295 * Math.atan2(accY, accZ)) - accPitchOffset
        accRoll = (-57.295 * Math.atan2(accX, accZ)) - accRollOffset
        // Degrees away from desired angle
        gyroXdelta = (gyroX - gyroXcalibration) * looptime * -0.00000762939
        gyroYdelta = (gyroY - gyroYcalibration) * looptime * 0.00000762939
        gyroZdelta = (gyroZ - gyroZcalibration) * looptime * -0.00000762939
        imuRoll = (gyroYdelta + imuRoll) * 0.99 + accRoll * 0.01
        imuPitch = (gyroXdelta + imuPitch) * 0.99 + accPitch * 0.01
        imuYaw = gyroZdelta + imuYaw
    }

    export function pcaSend(register: number, value: number) {
        pins.i2cWriteNumber(
            PCA_REG_SLAVEADR,
            register << 8 | value,
            NumberFormat.UInt16BE,
            false
        )
    }

    export function pcaStart() {
        pcaSend(PCA_REG_MODE1, 128)
        pcaSend(PCA_REG_MODE2, PCA_REG_MODE2_CONFIG)
        // Mode2:Inverted, Totem pole on = %10101(21), Non-inverted = %00101(5)
        // Mode2:Inverted, Open drain = %10001(17), Non-inverted = %00001(1)
        pcaSend(PCA_REG_LEDUOT, 170)

        MotorSpeed(0, 0, 0, 0)     // Zero out motor speed 
        // Self test to see if data reg can be read.
        pins.i2cWriteNumber(
            PCA_REG_SLAVEADR,
            PCA_REG_MODE2,
            NumberFormat.UInt8BE,
            true
        )
        let id = pins.i2cReadNumber(PCA_REG_SLAVEADR, NumberFormat.UInt8BE, false)
        basic.clearScreen()
        if (id) {
            // basic.showString("M")             Moved to main code, startup
            mcExists = true
        } else {
            // basic.showString("No PCA!", 50)   Moved to main code, startup
            mcExists = false
        }
    }

    export function stabilisePid() {

        rollDiff = roll - imuRoll
        pitchDiff = pitch - imuPitch      // Reversing the pitch
        yawDiff = yaw - imuYaw
        rollDdiff = rollDiff - lastRollDiff
        pitchDdiff = pitchDiff - lastPitchDiff
        yawDdiff = yawDiff - lastYawDiff

        lastRollDiff = rollDiff
        lastPitchDiff = pitchDiff
        lastYawDiff = yawDiff

        let iRange = 5      //  Maximal error that will increase Roll and Pitch integral
        let iLimit = 4      //  Maximal correcton that can be added by integral
        let yawLimit = 50   //  Maximal yaw correction 

        if (throttle > 50) {    // Prevent windup before flight

            if (rollDiff > - iRange && rollDiff < iRange) {
                rollIdiff += rollDiff
            }
            if (pitchDiff > - iRange && pitchDiff < iRange) {
                pitchIdiff += pitchDiff
            }

        }

        let rollIcorrection = rollIdiff * ROLLPITCH_I
        let pitchIcorrection = pitchIdiff * ROLLPITCH_I

        rollIcorrection = Math.constrain(rollIcorrection, -iLimit, iLimit)     // Limit I (preventing it from growing out of proportions)
        pitchIcorrection = Math.constrain(pitchIcorrection, -iLimit, iLimit)

        rollCorrection = rollDiff * ROLLPITCH_P + rollIcorrection + rollDdiff * ROLLPITCH_D
        pitchCorrection = pitchDiff * ROLLPITCH_P + pitchIcorrection + pitchDdiff * ROLLPITCH_D

        yawCorrection = yawDiff * yawP + yawDdiff * yawD
        yawCorrection = Math.constrain(yawCorrection, -yawLimit, yawLimit)
        throttleScaled = throttle * 2.55

        motorA = Math.round(throttleScaled + rollCorrection + pitchCorrection + yawCorrection)
        motorB = Math.round(throttleScaled + rollCorrection - pitchCorrection - yawCorrection)
        motorC = Math.round(throttleScaled - rollCorrection + pitchCorrection - yawCorrection)
        motorD = Math.round(throttleScaled - rollCorrection - pitchCorrection + yawCorrection)
        motorA = Math.constrain(motorA, 0, 255)
        motorB = Math.constrain(motorB, 0, 255)
        motorC = Math.constrain(motorC, 0, 255)
        motorD = Math.constrain(motorD, 0, 255)
    }

    function expo(inp: number) {
        const expoSetting = 2
        const expoFactor = 45 * 45 / (45 - 45 / expoSetting)
        if (inp >= 0) {
            return inp / expoSetting + inp * inp / expoFactor
        } else {
            return inp / expoSetting - inp * inp / expoFactor
        }
    }

    function lostSignalCheck() {
        // Failsafe makes only sense if already flying
        if (throttle > 65 && arm) {
            if (etradio.ellapsed() > 3000) {
                roll = 0
                pitch = 0
                yaw = 0
                throttle = 65
            }
            if (etradio.ellapsed() > 8000) {
                roll = 0
                pitch = 0
                yaw = 0
                throttle = 0
                arm = 0
            }
        }
    }

    input.onButtonPressed(Button.AB, function () {
        screenMode = 0
    })

    input.onButtonPressed(Button.A, function () {
        screenMode += -1
        if (screenMode < 0) {
            screenMode = 4
        }
    })

    input.onButtonPressed(Button.B, function () {
        screenMode += 1
        if (screenMode > 4) {
            screenMode = 0
        }
    })

    function screen() {
        // If charging is detected
        if (pins.analogReadPin(AnalogReadWritePin.P0) > 750) {
            // Charge mode can not happen when drone is flying
            if (arm == 0) {
                chargingScreen()
            }
        } else {
            switch (screenMode) {
                case 0: standardScreen(); break
                case 1: motorScreen(); break
                case 2: batteryScreen(); break
                case 3: voltageScreen(); break
                case 4: throttleScreen(); break
            }
        }
    }

    function standardScreen() {
        basic.clearScreen()
        led.plot(Math.map(roll, -15, 15, 0, 4), Math.map(pitch, -15, 15, 4, 0))
        led.plot(Math.map(yaw, -30, 30, 0, 4), 4)
        if (arm) {
            led.plot(0, 0)
        }
        if (stable && (mcExists && (gyroExists && notCharging))) {
            led.plot(2, 0)
        }
        drawBar(0, throttle)
        drawBar(4, batteryLevel())
    }

    function motorScreen() {
        basic.clearScreen()
        led.plotBrightness(0, 4, motorA)
        led.plotBrightness(0, 0, motorB)
        led.plotBrightness(4, 4, motorC)
        led.plotBrightness(4, 0, motorD)
        led.plot(Math.map(imuRoll, -15, 15, 0, 4), Math.map(imuPitch, -15, 15, 4, 0))
    }

    function throttleScreen() {
        basic.clearScreen()
        basic.showNumber(throttle)
    }

    function voltageScreen() {
        basic.clearScreen()
        basic.showNumber(mVoltBattery)
    }
    function batteryScreen() {
        led.plotBarGraph(batteryLevel(), 100)
    }

    function batteryIcon(level: number) {
        // Level 4: full
        // Level 3: medium-high
        // Level 2: medium-low
        // Level 1: low
        // Level 0: Empty
        led.plot(2, 4)
        led.plot(2, 0)
        for (let index = 0; index <= 3; index++) {
            led.plot(1, index + 1)
            led.plot(3, index + 1)
        }
        if (level > 0) {
            for (let index2 = 0; index2 <= level; index2++) {
                led.plot(2, 5 - index2)
            }
        } else {
            led.plot(0, 0)
            led.plot(2, 2)
            led.plot(4, 4)
        }
    }

    function chargingScreen() {
        if (chargingSwitch - pins.analogReadPin(AnalogReadWritePin.P0) > 20) {
            basic.showString("Connect battery", 100)
        } else {
            basic.pause(200)
        }
        chargingSwitch = pins.analogReadPin(AnalogReadWritePin.P0)
        if (chargingSwitch < 900) {
            basic.clearScreen()
            for (let index3 = 0; index3 <= 3; index3++) {
                batteryIcon(index3 + 1)
                basic.pause(500)
            }
            notCharging = false
        } else {
            basic.showIcon(IconNames.Yes)
            basic.showString("Charge finished!")
            notCharging = true
            chargingSwitch += 1
        }
    }

    function startupBatteryCheck() {
        basic.clearScreen()
        mVoltBattery = Math.round(pins.analogReadPin(AnalogPin.P0) * BATT_FACTOR)
        if (mVoltBattery > 4050) {
            batteryIcon(4)
        } else if (mVoltBattery > 3900) {
            batteryIcon(3)
        } else if (mVoltBattery > 3750) {
            batteryIcon(2)
        } else if (mVoltBattery > 3600) {
            batteryIcon(1)
        } else {
            batteryIcon(0)
        }
    }

    //% block="battery Level"
    //% block.loc.nl="batterijniveau"
    export function batteryLevel() {
        return Math.map(mVoltBattery, 3400, 4200, 0, 100)
    }

    //% block="set the motors in standby"
    //% block.loc.nl="zet de motoren in standby"
    export function standby() {
        arm = 1
    }

    //% block="turn the motors off"
    //% block.loc.nl="zet de motoren uit"
    export function freeze() {
        arm = 0
    }

    //% block="lift off"
    //% block.loc.nl="stijg op"
    export function levitate() {
        throttle = 40       // warm up
        basic.pause(500)
        throttle = 70       // levitate
        basic.pause(5000)
        throttle = 55       // hang still
   }

    //% block="land"
    //% block.loc.nl="land"
    export function land() {
        setThrottle(40)
        basic.pause(5000)
        setThrottle(0)
    }

    //% subcategory="Jargon"
    //% block="set arm to %value"
    //% block.loc.nl="stel de arm in op %value"
    export function setArm(value: boolean) {
        arm = (value ? 1 : 0);
    }

    //% subcategory="Jargon"
    //% block="set throttle to %value"
    //% block.loc.nl="stel de throttle in op %value"
    export function setThrottle(value: number) {
        throttle = Math.constrain(value, 0, mVoltBattery < 3400 ? 75 : 100)
    }

    //% subcategory="Jargon"
    //% block="set pitch to %value"
    //% block.loc.nl="stel de pitch in op %value"
    export function setPitch(value: number) {
        pitch = expo(value) / -3
        pitch = Math.constrain(pitch, -15, 15)
    }

    //% subcategory="Jargon"
    //% block="set roll to %value"
    //% block.loc.nl="stel de roll in op %value"
    export function setRoll(value: number) {
        roll = expo(value) / 3
        roll = Math.constrain(roll, -15, 15)
    }

    //% subcategory="Jargon"
    //% block="set yaw to %value"
    //% block.loc.nl="stel de yaw in op %value"
    export function setYaw(value: number) {
        yaw += value * 0.1
    }
}

/////////////////
// END INCLUDE //
/////////////////
