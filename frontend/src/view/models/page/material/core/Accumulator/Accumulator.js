export class Accumulator {
    /**
     * @param {number} initialTime - optionaler Startwert (z.B. 0)
     * @param {number} speed - optionaler Multiplikator für dieses Child
     */
    constructor(initialTime = 0, speed = 1.0) {
        this.time = initialTime;     // akkumulierte Zeit
        this.lastTime = initialTime; // Zeit des letzten Frames
        this.deltaTime = 0;          // delta vom letzten Update
        this.speed = speed;          // Multiplikator für schnelle/langsame Systeme
    }

    /**
     * Update des Accumulators mit globalem deltaTime
     * @param {number} dt - globale deltaTime vom Renderer
     */
    update(dt) {
        this.deltaTime = dt * this.speed;
        this.lastTime = this.time;
        this.time += this.deltaTime;
    }

    /**
     * Speed ändern (z.B. TREE langsamer, EFFECT schneller)
     * @param {number} speed
     */
    setSpeed(speed) {
        this.speed = speed;
    }

    /**
     * Reset auf bestimmten Startwert
     * @param {number} startTime
     */
    reset(startTime = 0) {
        this.time = startTime;
        this.lastTime = startTime;
        this.deltaTime = 0;
    }
}
