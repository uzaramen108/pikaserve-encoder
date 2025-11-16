/**
 * The Controller part in MVC pattern
 */
'use strict';
import { GROUND_HALF_WIDTH, PikaPhysics} from './physics.js';
import { MenuView, GameView, FadeInOut, IntroView } from './view.js';
import { PikaKeyboard } from './keyboard.js';
import { PikaAudio } from './audio.js';
import { PikaUserInput } from './physics.js';
import { replaySaver } from './replay/replay_saver.js';
import { true_rand, setCustomRng, rand } from './rand.js';
import seedrandom from 'seedrandom';

/** @typedef {import('@pixi/display').Container} Container */
/** @typedef {import('@pixi/loaders').LoaderResource} LoaderResource */

/** @typedef GameState @type {function():void} */

/**
 * Class representing Pikachu Volleyball game
 */
export class PikachuVolleyball {
  /**
   * Create a Pikachu Volleyball game which includes physics, view, audio
   * @param {Container} stage container which is rendered by PIXI.Renderer or PIXI.CanvasRenderer
   * @param {Object.<string,LoaderResource>} resources resources property of the PIXI.Loader object which is used for loading the game resources
   */
  constructor(stage, resources) {
    this.view = {
      intro: new IntroView(resources),
      menu: new MenuView(resources),
      game: new GameView(resources),
      fadeInOut: new FadeInOut(resources),
    };
    stage.addChild(this.view.intro.container);
    stage.addChild(this.view.menu.container);
    stage.addChild(this.view.game.container);
    stage.addChild(this.view.fadeInOut.black);
    this.view.intro.visible = false;
    this.view.menu.visible = false;
    this.view.game.visible = false;
    this.view.fadeInOut.visible = false;
    this.willSaveReplay = true

    this.audio = new PikaAudio(resources);
    this.physics = new PikaPhysics(true, true);
    this.keyboardArray = [
      new PikaKeyboard('KeyD', 'KeyG', 'KeyR', 'KeyV', 'KeyZ', 'KeyF', ), // for player1
      new PikaKeyboard( // for player2
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Enter'
      ),
    ];

    /** @type {number} game fps */
    this.normalFPS = 25;
    /** @type {number} fps for slow motion */
    this.slowMotionFPS = 5;

    /** @constant @type {number} number of frames for slow motion */
    this.SLOW_MOTION_FRAMES_NUM = 6;
    /** @type {number} number of frames left for slow motion */
    this.slowMotionFramesLeft = 0;
    /** @type {number} number of elapsed normal fps frames for rendering slow motion */
    this.slowMotionNumOfSkippedFrames = 0;

    /** @type {number} 0: with computer, 1: with friend */
    this.selectedWithWho = 0;

    /** @type {number[]} [0] for player 1 score, [1] for player 2 score */
    this.scores = [0, 0];
    /** @type {number} winning score: if either one of the players reaches this score, game ends */
    this.winningScore = 15;

    /** @type {boolean} Is the game ended? */
    this.gameEnded = false;
    /** @type {boolean} Is the round ended? */
    this.roundEnded = false;
    /** @type {boolean} Will player 2 serve? */
    this.isPlayer2Serve = false;

    /** @type {number} frame counter */
    this.frameCounter = 0;
    /** @type {Object.<string,number>} total number of frames for each game state */
    this.frameTotal = {
      intro: 165,
      afterMenuSelection: 15,
      beforeStartOfNewGame: 15,
      startOfNewGame: 71,
      afterEndOfRound: 5,
      beforeStartOfNextRound: 30,
      gameEnd: 211,
    };

    /** @type {number} counter for frames while there is no input from keyboard */
    this.noInputFrameCounter = 0;
    /** @type {Object.<string,number>} total number of frames to be rendered while there is no input */
    this.noInputFrameTotal = {
      menu: 225,
    };

    /** @type {boolean} true: paused, false: not paused */
    this.paused = false;

    /** @type {boolean} true: stereo, false: mono */
    this.isStereoSound = true;

    /** @type {boolean} true: practice mode on, false: practice mode off */
    this._isPracticeMode = false;

    /**
     * The game state which is being rendered now
     * @type {GameState}
     */
    this.state = this.intro;
  }

  /**
   * Game loop
   * This function should be called at regular intervals ( interval = (1 / FPS) second )
   */
  gameLoop() {
    if (this.paused === true) {
      return;
    }
    // catch keyboard input and freeze it
    this.keyboardArray[0].getInput();
    this.keyboardArray[1].getInput();
    const player1Input = new PikaUserInput();
    const player2Input = new PikaUserInput();
    player1Input.xDirection = this.keyboardArray[0].xDirection;
    player1Input.yDirection = this.keyboardArray[0].yDirection;
    player1Input.powerHit = this.keyboardArray[0].powerHit;
    player2Input.xDirection = this.keyboardArray[1].xDirection;
    player2Input.yDirection = this.keyboardArray[1].yDirection;
    player2Input.powerHit = this.keyboardArray[1].powerHit;
    
    replaySaver.recordInputs(player1Input, player2Input);
    if (this.slowMotionFramesLeft > 0) {
      this.slowMotionNumOfSkippedFrames++;
      if (
        this.slowMotionNumOfSkippedFrames %
          Math.round(this.normalFPS / this.slowMotionFPS) !== 0
      ) {
        return;
      }
      this.slowMotionFramesLeft--;
      this.slowMotionNumOfSkippedFrames = 0;
    }
    this.state();
  }

  

  /**
   * Intro: a man with a brief case
   * @type {GameState}
   */
  intro() {
    if (this.frameCounter === 0) {
      this.view.intro.visible = true;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.audio.sounds.bgm.stop();
    }
    this.view.intro.drawMark(this.frameCounter);
    this.frameCounter++;

    if (
      this.keyboardArray[0].powerHit === 1 ||
      this.keyboardArray[1].powerHit === 1
    ) {
      this.frameCounter = 0;
      this.view.intro.visible = false;
      this.state = this.menu;
    }

    if (this.frameCounter >= this.frameTotal.intro) {
      this.frameCounter = 0;
      this.view.intro.visible = false;
      this.state = this.menu;
    }
  }

  /**
   * Menu: select who do you want to play. With computer? With friend?
   * @type {GameState}
   */
  menu() {
    if (this.frameCounter === 0) {
      this.view.menu.visible = true;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.selectedWithWho = 0;
      this.view.menu.selectWithWho(this.selectedWithWho);
    }
    this.view.menu.drawFightMessage(this.frameCounter);
    this.view.menu.drawSachisoft(this.frameCounter);
    this.view.menu.drawSittingPikachuTiles(this.frameCounter);
    this.view.menu.drawPikachuVolleyballMessage(this.frameCounter);
    this.view.menu.drawPokemonMessage(this.frameCounter);
    this.view.menu.drawWithWhoMessages(this.frameCounter);
    this.frameCounter++;

    if (
      this.frameCounter < 71 &&
      (this.keyboardArray[0].powerHit === 1 ||
        this.keyboardArray[1].powerHit === 1)
    ) {
      this.frameCounter = 71;
      return;
    }

    if (this.frameCounter <= 71) {
      return;
    }

    if (
      (this.keyboardArray[0].yDirection === -1 ||
        this.keyboardArray[1].yDirection === -1) &&
      this.selectedWithWho === 1
    ) {
      this.noInputFrameCounter = 0;
      this.selectedWithWho = 0;
      this.view.menu.selectWithWho(this.selectedWithWho);
      this.audio.sounds.pi.play();
    } else if (
      (this.keyboardArray[0].yDirection === 1 ||
        this.keyboardArray[1].yDirection === 1) &&
      this.selectedWithWho === 0
    ) {
      this.noInputFrameCounter = 0;
      this.selectedWithWho = 1;
      this.view.menu.selectWithWho(this.selectedWithWho);
      this.audio.sounds.pi.play();
    } else {
      this.noInputFrameCounter++;
    }

    if (
      this.keyboardArray[0].powerHit === 1 ||
      this.keyboardArray[1].powerHit === 1
    ) {
      if (this.selectedWithWho === 1) {
        this.physics.player1.isComputer = false;
        this.physics.player2.isComputer = false;
      } else {
        if (this.keyboardArray[0].powerHit === 1) {
          this.physics.player1.isComputer = false;
          this.physics.player2.isComputer = true;
        } else if (this.keyboardArray[1].powerHit === 1) {
          this.physics.player1.isComputer = true;
          this.physics.player2.isComputer = false;
        }
      }
      this.audio.sounds.pikachu.play();
      this.frameCounter = 0;
      this.noInputFrameCounter = 0;
      this.state = this.afterMenuSelection;
      return;
    }

    // if (this.noInputFrameCounter >= this.noInputFrameTotal.menu) {
    //   this.physics.player1.isComputer = true;
    //   this.physics.player2.isComputer = true;
    //   this.frameCounter = 0;
    //   this.noInputFrameCounter = 0;
    //   this.state = this.afterMenuSelection;
    // }
  }

  /**
   * Fade out after menu selection
   * @type {GameState}
   */
  afterMenuSelection() {
    this.view.fadeInOut.changeBlackAlphaBy(1 / 16);
    this.frameCounter++;
    if (this.frameCounter >= this.frameTotal.afterMenuSelection) {
      this.frameCounter = 0;
      this.state = this.beforeStartOfNewGame;
    }
  }

  /**
   * Delay before start of new game (This is for the delay that exist in the original game)
   * @type {GameState}
   */
  beforeStartOfNewGame() {
    this.frameCounter++;
    if (this.frameCounter >= this.frameTotal.beforeStartOfNewGame) {
      this.frameCounter = 0;
      this.view.menu.visible = false;
      this.state = this.startOfNewGame;
    }
  }

  /**
   * Start of new game: Initialize ball and players and print game start message
   * @type {GameState}
   */
  startOfNewGame() {
    if (this.frameCounter === 0) {
      this.view.game.visible = true;
      this.gameEnded = false;
      this.roundEnded = false;
      this.isPlayer2Serve = false;
      this.physics.player1.gameEnded = false;
      this.physics.player1.isWinner = false;
      this.physics.player2.gameEnded = false;
      this.physics.player2.isWinner = false;

      this.scores[0] = 0;
      this.scores[1] = 0;
      this.view.game.drawScoresToScoreBoards(this.scores);

      this.physics.player1.initializeForNewRound();
      this.physics.player2.initializeForNewRound();
      this.physics.ball.initializeForNewRound(this.isPlayer2Serve);
      if (this.physics.player1.isComputer) {
        this.physics.ball.x = 376;
      } else {
        this.physics.ball.x = 56;
      }
      this.view.game.drawPlayersAndBall(this.physics);

      this.view.fadeInOut.setBlackAlphaTo(1); // set black screen
      this.audio.sounds.bgm.play();
    }

    this.view.game.drawGameStartMessage(
      this.frameCounter,
      this.frameTotal.startOfNewGame
    );
    this.view.game.drawCloudsAndWave();
    this.view.fadeInOut.changeBlackAlphaBy(-(1 / 17)); // fade in
    this.frameCounter++;

    if (this.frameCounter >= this.frameTotal.startOfNewGame) {
      this.frameCounter = 0;
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.state = this.round;
    }
  }

  /**
   * Round: the players play volleyball in this game state
   * @type {GameState}
   */
  round() {
    const pressedPowerHit =
      this.keyboardArray[0].powerHit === 1 ||
      this.keyboardArray[1].powerHit === 1;

    if (
      this.physics.player1.isComputer === true &&
      this.physics.player2.isComputer === true &&
      pressedPowerHit
    ) {
      this.frameCounter = 0;
      this.view.game.visible = false;
      this.state = this.intro;
      return;
    }

    if (this.physics.player1.isComputer) {
      this.keyboardArray[1].xDirection =
        this.keyboardArray[0].xDirection || this.keyboardArray[1].xDirection;
      this.keyboardArray[1].yDirection =
        this.keyboardArray[0].yDirection || this.keyboardArray[1].yDirection;
      this.keyboardArray[1].powerHit =
        this.keyboardArray[0].powerHit || this.keyboardArray[1].powerHit;
    }
    if (this.physics.player2.isComputer) {
      this.keyboardArray[0].xDirection =
        this.keyboardArray[0].xDirection || this.keyboardArray[1].xDirection;
      this.keyboardArray[0].yDirection =
        this.keyboardArray[0].yDirection || this.keyboardArray[1].yDirection;
      this.keyboardArray[0].powerHit =
        this.keyboardArray[0].powerHit || this.keyboardArray[1].powerHit;
    }
    const player1Input = new PikaUserInput();
    const player2Input = new PikaUserInput();
    player1Input.xDirection = this.keyboardArray[0].xDirection;
    player1Input.yDirection = this.keyboardArray[0].yDirection;
    player1Input.powerHit = this.keyboardArray[0].powerHit;
    player2Input.xDirection = this.keyboardArray[1].xDirection;
    player2Input.yDirection = this.keyboardArray[1].yDirection;
    player2Input.powerHit = this.keyboardArray[1].powerHit;
    if (this.physics.player1.isComputer) {
      ActList.push(player2Input);
    } else {
      ActList.push(player1Input);
    }

    const isBallTouchingGround = this.physics.runEngineForNextFrame(
      this.keyboardArray
    );
    

    if (isBallTouchingGround) {
        let CodeOutput = [];
        if (this.physics.player1.isComputer) {
          console.log(ActList);
          CodeOutput = encodeActList(ActList, 2);
        } else {
          console.log(ActList);
          CodeOutput = encodeActList(ActList, 1);
        }
        let MsgOutput = concatListAsString(CodeOutput);
        logToNotepad(MsgOutput.slice(1));
        ActList.length = 0;
    }

    this.playSoundEffect();
    this.view.game.drawPlayersAndBall(this.physics);
    this.view.game.drawCloudsAndWave();

    if (this.gameEnded === true) {
      this.view.game.drawGameEndMessage(this.frameCounter);
      this.frameCounter++;
      if (
        this.frameCounter >= this.frameTotal.gameEnd ||
        (this.frameCounter >= 70 && pressedPowerHit)
      ) {
        this.frameCounter = 0;
        this.view.game.visible = false;
        this.state = this.intro;
      }
      return;
    }

    if (
      isBallTouchingGround &&
      this._isPracticeMode === false &&
      this.roundEnded === false &&
      this.gameEnded === false
    ) {
      if (this.physics.ball.punchEffectX < GROUND_HALF_WIDTH) {
        this.isPlayer2Serve = true;
        if (this.scores[1] >= this.winningScore) {
          this.gameEnded = true;
          this.physics.player1.isWinner = false;
          this.physics.player2.isWinner = true;
          this.physics.player1.gameEnded = true;
          this.physics.player2.gameEnded = true;
        }
      } else {
        this.isPlayer2Serve = false;
        if (this.scores[0] >= this.winningScore) {
          this.gameEnded = true;
          this.physics.player1.isWinner = true;
          this.physics.player2.isWinner = false;
          this.physics.player1.gameEnded = true;
          this.physics.player2.gameEnded = true;
        }
      }
      this.view.game.drawScoresToScoreBoards(this.scores);
      if (this.roundEnded === false && this.gameEnded === false) {
        this.slowMotionFramesLeft = this.SLOW_MOTION_FRAMES_NUM;
      }
      this.roundEnded = true;
    }

    if (this.roundEnded === true && this.gameEnded === false) {
      // if this is the last frame of this round, begin fade out
      if (this.slowMotionFramesLeft === 0) {
        this.view.fadeInOut.changeBlackAlphaBy(1 /16); // fade out
        this.state = this.afterEndOfRound;
      }
    }
  }

  /**
   * Fade out after end of round
   * @type {GameState}
   */
  afterEndOfRound() {
    this.view.fadeInOut.changeBlackAlphaBy(1 /16);
    this.frameCounter++;
    
    if (this.frameCounter >= this.frameTotal.afterEndOfRound) {
      this.frameCounter = 0;
      this.state = this.beforeStartOfNextRound;
    }
  }
  
  /**
   * Before start of next round, initialize ball and players, and print ready message
   * @type {GameState}
   */
  beforeStartOfNextRound() {
    if (this.frameCounter === 0) {
      this.view.fadeInOut.setBlackAlphaTo(1);
      this.view.game.drawReadyMessage(false);

      this.physics.player1.initializeForNewRound();
      this.physics.player2.initializeForNewRound();
      this.physics.ball.initializeForNewRound(this.isPlayer2Serve);
      if (this.physics.player1.isComputer) {
        this.physics.ball.x = 376;
      } else {
        this.physics.ball.x = 56;
      }
      this.view.game.drawPlayersAndBall(this.physics);
    }

    this.view.game.drawCloudsAndWave();
    this.view.fadeInOut.changeBlackAlphaBy(-(1 /16));

    this.frameCounter++;
    if (this.frameCounter % 5 === 0) {
      this.view.game.toggleReadyMessage();
    }

    if (this.frameCounter >= this.frameTotal.beforeStartOfNextRound) {
      this.frameCounter = 0;
      this.view.game.drawReadyMessage(false);
      this.view.fadeInOut.setBlackAlphaTo(0);
      this.roundEnded = false;
      ActList.length = 0;
      this.state = this.round;
    }
  }

  /**
   * Play sound effect on {@link round}
   */
  playSoundEffect() {
    const audio = this.audio;
    for (let i = 0; i < 2; i++) {
      const player = this.physics[`player${i + 1}`];
      const sound = player.sound;
      let leftOrCenterOrRight = 0;
      if (this.isStereoSound) {
        leftOrCenterOrRight = i === 0 ? -1 : 1;
      }
      if (sound.pipikachu === true) {
        audio.sounds.pipikachu.play(leftOrCenterOrRight);
        sound.pipikachu = false;
      }
      if (sound.pika === true) {
        audio.sounds.pika.play(leftOrCenterOrRight);
        sound.pika = false;
      }
      if (sound.chu === true) {
        audio.sounds.chu.play(leftOrCenterOrRight);
        sound.chu = false;
      }
    }
    const ball = this.physics.ball;
    const sound = ball.sound;
    let leftOrCenterOrRight = 0;
    if (this.isStereoSound) {
      if (ball.punchEffectX < GROUND_HALF_WIDTH) {
        leftOrCenterOrRight = -1;
      } else if (ball.punchEffectX > GROUND_HALF_WIDTH) {
        leftOrCenterOrRight = 1;
      }
    }
    if (sound.powerHit === true) {
      audio.sounds.powerHit.play(leftOrCenterOrRight);
      sound.powerHit = false;
    }
    if (sound.ballTouchesGround === true) {
      audio.sounds.ballTouchesGround.play(leftOrCenterOrRight);
      sound.ballTouchesGround = false;
    }
  }

  /**
   * Called if restart button clicked
   */
  restart() {
    this.frameCounter = 0;
    this.noInputFrameCounter = 0;
    this.slowMotionFramesLeft = 0;
    this.slowMotionNumOfSkippedFrames = 0;
    this.view.menu.visible = false;
    this.view.game.visible = false;
    ActList.length = 0;
    this.state = this.intro;
    const roomId = 'uzaramen' + true_rand();
    replaySaver.recordRoomID(roomId);
    const customRng = seedrandom.alea(roomId.slice(8));
    setCustomRng(customRng);
  }

  /** @return {boolean} */
  get isPracticeMode() {
    return this._isPracticeMode;
  }

  /**
   * @param {boolean} bool true: turn on practice mode, false: turn off practice mode
   */
  set isPracticeMode(bool) {
    this._isPracticeMode = bool;
    this.view.game.scoreBoards[0].visible = !bool;
    this.view.game.scoreBoards[1].visible = !bool;
  }
}

const ActList = [];

/**
 * @param {PikaUserInput} userInput 
 */
function encodeUserInput(userInput, playerNum) {
  if (playerNum == 1) {
    if (userInput.powerHit == 1) {
      if (userInput.xDirection == -1 && userInput.yDirection == -1) {
        return "-ULH/";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 0) {
        return "-LH/";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 1) {
        return "-DLH/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == -1) {
        return "-UH/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 0) {
        return "-H/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 1) {
        return "-DH/";
      } else if (userInput.xDirection == 1 && userInput.yDirection == -1) {
        return "-URH/";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 0) {
        return "-RH/";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 1) {
        return "-DRH/";
      } 
    } else if (userInput.powerHit == 0) {
      if (userInput.xDirection == -1 && userInput.yDirection == -1) {
        return "-UL/";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 0) {
        return "-L/";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 1) {
        return "-DL/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == -1) {
        return "-U/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 0) {
        return "-/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 1) {
        return "-D/";
      } else if (userInput.xDirection == 1 && userInput.yDirection == -1) {
        return "-UR/";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 0) {
        return "-R/";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 1) {
        return "-DR/";
      } 
    } 
  } else {
    if (userInput.powerHit == 1) {
      if (userInput.xDirection == -1 && userInput.yDirection == -1) {
        return "-/ULH";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 0) {
        return "-/LH";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 1) {
        return "-/DLH";
      } else if (userInput.xDirection == 0 && userInput.yDirection == -1) {
        return "-/UH";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 0) {
        return "-/H";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 1) {
        return "-/DH";
      } else if (userInput.xDirection == 1 && userInput.yDirection == -1) {
        return "-/URH";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 0) {
        return "-/RH";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 1) {
        return "-/DRH";
      } 
    } else if (userInput.powerHit == 0) {
      if (userInput.xDirection == -1 && userInput.yDirection == -1) {
        return "-/UL";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 0) {
        return "-/L";
      } else if (userInput.xDirection == -1 && userInput.yDirection == 1) {
        return "-/DL";
      } else if (userInput.xDirection == 0 && userInput.yDirection == -1) {
        return "-/U";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 0) {
        return "-/";
      } else if (userInput.xDirection == 0 && userInput.yDirection == 1) {
        return "-/D";
      } else if (userInput.xDirection == 1 && userInput.yDirection == -1) {
        return "-/UR";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 0) {
        return "-/R";
      } else if (userInput.xDirection == 1 && userInput.yDirection == 1) {
        return "-/DR";
      } 
    } 

  }
}
/**
 * 클래스가 'notepad-log'인 요소에 로그 메시지를 추가합니다.
 * @param {string} message - 추가할 메시지
 */
function logToNotepad(message) {
  const target = document.getElementById('code-viewer-output');
  if (!target) return;

  // 기존 내용을 지우고 새 메시지를 텍스트로 삽입
  target.textContent = message;
}

function encodeActList(code, playerNum) {
  let code_length = code.length;
  let new_code = [];
  for (let i = 0; i < code_length; i++) {
    new_code.push(encodeUserInput(code[i], playerNum));
  }
  return new_code;
}

function concatListAsString(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return '';

    let result = '';
    let current = arr[0];
    let count = 1;

    for (let i = 1; i < arr.length; i++) {
      if (arr[i] === current) {
        count++;
      } else {
        result += current + count;
        current = arr[i];
        count = 1;
      }
    }

    // 마지막 문자 처리
    result += current + count;

    return result;
}