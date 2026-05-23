import {isFiniteNumber} from "@/utils/math";

export class Accumulator {
    constructor(initialTime = 0, speed = 1) {
        this.time = Accumulator.toNumber(initialTime);
        this.lastTime = this.time;
        this.deltaTime = 0;
        this.speed = Accumulator.toNumber(speed, 1);
    }

    static toNumber(value, fallback = 0) {
        const number = Number(value);

        return isFiniteNumber(number) ? number : fallback;
    }

    update(deltaTime = 0) {
        this.deltaTime = Math.max(0, Accumulator.toNumber(deltaTime)) * this.speed;
        this.lastTime = this.time;
        this.time += this.deltaTime;

        return this;
    }

    setSpeed(speed = 1) {
        this.speed = Accumulator.toNumber(speed, 1);

        return this;
    }

    reset(startTime = 0) {
        this.time = Accumulator.toNumber(startTime);
        this.lastTime = this.time;
        this.deltaTime = 0;

        return this;
    }

    toPayload() {
        return {
            time: this.time,
            lastTime: this.lastTime,
            deltaTime: this.deltaTime,
            speed: this.speed,
        };
    }
}
