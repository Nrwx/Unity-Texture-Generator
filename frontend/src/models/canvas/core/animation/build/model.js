import { Animation } from "@/models/canvas/core/animation/layer/model";

export class AnimationFactory {
    static create(name, keyframes) {
        return new Animation(name, keyframes);
    }
}