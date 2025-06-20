/**
 * This module takes charge of the user input via keyboard
 */
'use strict';
import { PikaUserInput } from './physics.js';

/**
 * Class representing a keyboard used to control a player
 */
export class PikaKeyboard extends PikaUserInput {
  constructor(left, right, up, down, powerHit, downRight = null, extraKeys = []) {
    super();

    /** @type {boolean} */
    this.powerHitKeyIsDownPrevious = false;

    /** @type {Key[]} 기본 키 설정 */
    this.keys = [
      new Key(left), new Key(right), new Key(up), new Key(down), new Key(powerHit),
    ];

    /** @type {Key[]} 추가 키 설정 (D, F, R, G, V, Z 등) */
      this.extraKeys = Array.isArray(extraKeys) ? extraKeys.map(key => new Key(key)) : [];  // ✅ extraKeys가 배열이 아닐 경우 빈 배열로 설정
  }

 getInput(amIPlayer2 = false) {
    let leftPressed = this.keys[0].isDown || this.extraKeys.some(key => key.value === 'KeyD' && key.isDown);  // ✅ D 키 → 왼쪽 이동
    let rightPressed = this.keys[1].isDown || this.extraKeys.some(key => key.value === 'KeyG' && key.isDown);  // ✅ G 키 → 오른쪽 이동
    let upPressed = this.keys[2].isDown || this.extraKeys.some(key => key.value === 'KeyR' && key.isDown);
    let downPressed = this.keys[3]?.isDown || this.extraKeys.some(key => key.isDown && ['KeyV', 'KeyF', 'ArrowDown'].includes(key.value));
    let powerHitPressed = this.keys[4].isDown || this.extraKeys.some(key => key.value === 'KeyZ' && key.isDown);

    this.xDirection = leftPressed ? -1 : rightPressed ? 1 : 0;
    this.yDirection = upPressed ? -1 : downPressed ? 1 : 0;

    const isDown = powerHitPressed;
    this.powerHit = !this.powerHitKeyIsDownPrevious && isDown ? 1 : 0;
    this.powerHitKeyIsDownPrevious = isDown;
}


  /**
   * Subscribe keydown, keyup event listeners for the keys of this keyboard
   */
  subscribe() {
      this.keys.forEach(key => key.subscribe());  // ✅ 모든 기본 키에 대해 subscribe() 실행
      this.extraKeys.forEach(key => key.subscribe());  // ✅ 추가된 키들도 subscribe() 실행
      
      if (this.downRightKey) { // ✅ downRightKey가 존재할 때만 실행하도록 조건 추가
          this.downRightKey.subscribe();
      }
  }

  /**
   * Unsubscribe keydown, keyup event listeners for the keys of this keyboard
   */
  unsubscribe() {
      this.keys.forEach(key => key.unsubscribe());  // ✅ 모든 기본 키 unsubscribe() 실행
      this.extraKeys.forEach(key => key.unsubscribe());  // ✅ 추가된 키들도 unsubscribe() 실행

      if (this.downRightKey) {
          this.downRightKey.unsubscribe();  // ✅ downRightKey가 존재하는 경우만 unsubscribe 실행
      }
  }
}

/**
 * Class representing a key on a keyboard
 * referred to: https://github.com/kittykatattack/learningPixi
 */
class Key {
  /**
   * Create a key
   * Refer {@link https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values}
   * @param {string} value KeyboardEvent.code value of this key
   */
  constructor(value) {
    this.value = value;
    this.isDown = false;
    this.isUp = true;

    this.downListener = this.downHandler.bind(this);
    this.upListener = this.upHandler.bind(this);
    this.subscribe();
  }

  /**
   * When key downed
   * @param {KeyboardEvent} event
   */
  downHandler(event) {
    if (event.code === this.value) {
      this.isDown = true;
      this.isUp = false;
      event.preventDefault();
    }
  }

  /**
   * When key upped
   * @param {KeyboardEvent} event
   */
  upHandler(event) {
    if (event.code === this.value) {
      this.isDown = false;
      this.isUp = true;
      event.preventDefault();
    }
  }

  /**
   * Subscribe event listeners
   */
  subscribe() {
    // I think an event listener for keyup should be attached
    // before the one for keydown to prevent a buggy behavior.
    // If keydown event listener were attached first and
    // a key was downed and upped before keyup event listener were attached,
    // I think the value of this.isDown would be true (and the value of this.isUp would be false)
    // for a while before the user press this key again.
    window.addEventListener('keyup', this.upListener);
    window.addEventListener('keydown', this.downListener);
  }

  /**
   * Unsubscribe event listeners
   */
  unsubscribe() {
    window.removeEventListener('keydown', this.downListener);
    window.removeEventListener('keyup', this.upListener);
    this.isDown = false;
    this.isUp = true;
  }
}
