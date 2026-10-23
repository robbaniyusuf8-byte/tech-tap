
import './style.css';
import { Application, Container, Graphics, Text } from 'pixi.js';

const THEMES = {
  'Node.js': {
    correct: ['Express.js', 'NestJS', 'Fastify', 'Hono', 'Koa'],
    wrong: ['Laravel', 'Django', 'Ruby on Rails', 'Spring Boot'],
  },
  PHP: {
    correct: ['Laravel', 'CodeIgniter', 'Symfony', 'Slim', 'WordPress'],
    wrong: ['Express.js', 'NestJS', 'Fastify', 'Django'],
  },
};

const ROUND_DURATION = 30_000;

const DIFFICULTIES = {
  Easy: {
    cardLifetime: 3_000,
    spawnInterval: 800,
    label: 'Mudah',
  },
  Medium: {
    cardLifetime: 2_000,
    spawnInterval: 500,
    label: 'Normal',
  },
  Hard: {
    cardLifetime: 1_200,
    spawnInterval: 350,
    label: 'Sulit',
  },
};

const FADE_IN_DURATION = 180;
const FADE_OUT_DURATION = 350;
const FEEDBACK_DURATION = 600;

async function main() {
  const root = document.querySelector('#app');

  if (!root) {
    throw new Error('Elemen #app tidak ditemukan.');
  }

  const app = new Application();

  await app.init({
    background: '#0b1020',
    resizeTo: root,
    antialias: true,
  });

  root.replaceChildren(app.canvas);

  const game = new Container();
  app.stage.addChild(game);

  let score = 0;
  let highScore = Number(
    localStorage.getItem('techTapHighScore') || 0
  );

  let elapsed = 0;
  let spawnElapsed = 0;
  let gameRunning = false;
  let selectedTheme = 'Node.js';
  let selectedDifficulty = 'Medium';
  let overlay = null;

  const cards = new Set();
  const feedbacks = new Set();

  function makeText(text, size, color = '#ffffff') {
    return new Text({
      text,
      style: {
        fontFamily: 'Arial',
        fontSize: size,
        fill: color,
        fontWeight: 'bold',
      },
    });
  }

  function makeButton(label, width, height, color, callback) {
    const button = new Container();

    button.eventMode = 'static';
    button.cursor = 'pointer';

    const background = new Graphics()
      .roundRect(0, 0, width, height, 12)
      .fill({ color });

    const text = makeText(label, 17);
    text.anchor.set(0.5);
    text.position.set(width / 2, height / 2);

    button.addChild(background, text);
    button.on('pointertap', callback);

    return button;
  }

  const scoreText = makeText('Score: 0', 22);
  scoreText.position.set(24, 20);
  game.addChild(scoreText);

  const timerText = makeText('Time: 30', 22);
  timerText.anchor.set(1, 0);
  game.addChild(timerText);

  const themeText = makeText('', 16, '#65e6bd');
  themeText.position.set(24, 55);
  game.addChild(themeText);

  const progressTrack = new Graphics();
  const progressFill = new Graphics();

  game.addChild(progressTrack, progressFill);

  function updateHeader() {
    timerText.x = app.screen.width - 24;
  }

  updateHeader();
  app.renderer.on('resize', updateHeader);

  function clearCards() {
    for (const data of cards) {
      data.removed = true;
      data.card.removeFromParent();
      data.card.destroy({ children: true });
    }

    cards.clear();
  }

  function clearFeedbacks() {
    for (const item of feedbacks) {
      app.ticker.remove(item.animate);
      item.text.removeFromParent();
      item.text.destroy();
    }

    feedbacks.clear();
  }

  function removeOverlay() {
    if (!overlay) return;

    overlay.removeFromParent();
    overlay.destroy({ children: true });
    overlay = null;
  }

  function showFeedback(x, y, points) {
    const feedback = makeText(
      points > 0 ? '+10' : '-5',
      28,
      points > 0 ? '#38e8a8' : '#ff646e'
    );

    feedback.anchor.set(0.5);
    feedback.position.set(x, y);
    game.addChild(feedback);

    const item = {
      text: feedback,
      age: 0,
      animate: null,
    };

    item.animate = (ticker) => {
      item.age += ticker.deltaMS;

      feedback.y -= ticker.deltaMS * 0.04;
      feedback.alpha = Math.max(
        0,
        1 - item.age / FEEDBACK_DURATION
      );

      if (item.age >= FEEDBACK_DURATION) {
        app.ticker.remove(item.animate);
        feedback.removeFromParent();
        feedback.destroy();
        feedbacks.delete(item);
      }
    };

    feedbacks.add(item);
    app.ticker.add(item.animate);
  }

  function showTapEffect(card, points) {
    const width = 160;
    const height = 76;
    const centerX = card.x + width / 2;
    const centerY = card.y + height / 2;
    const duration = 220;

    card.pivot.set(width / 2, height / 2);
    card.position.set(centerX, centerY);
    card.scale.set(1);

    const sparkleColor = points > 0 ? 0x38e8a8 : 0xff646e;
    const particles = [];

    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;

      const particle = new Graphics()
        .circle(0, 0, i % 2 === 0 ? 4 : 2.5)
        .fill({ color: sparkleColor });

      particle.position.set(centerX, centerY);
      game.addChild(particle);

      particles.push({
        graphic: particle,
        vx: Math.cos(angle) * 0.16,
        vy: Math.sin(angle) * 0.16,
      });
    }

    let age = 0;

    const animate = (ticker) => {
      age += ticker.deltaMS;

      const progress = Math.min(1, age / duration);

      card.scale.set(1 + progress * 0.25);
      card.alpha = 1 - progress;

      for (const particle of particles) {
        particle.graphic.x += particle.vx * ticker.deltaMS;
        particle.graphic.y += particle.vy * ticker.deltaMS;
        particle.graphic.alpha = 1 - progress;
      }

      if (age >= duration) {
        app.ticker.remove(animate);

        card.removeFromParent();
        card.destroy({ children: true });

        for (const particle of particles) {
          particle.graphic.removeFromParent();
          particle.graphic.destroy();
        }
      }
    };

    app.ticker.add(animate);
  }

  function spawnCard() {
    if (!gameRunning) return;

    const theme = THEMES[selectedTheme];
    const isCorrect = Math.random() < 0.65;
    const words = isCorrect ? theme.correct : theme.wrong;
    const word = words[Math.floor(Math.random() * words.length)];

    const width = 160;
    const height = 76;
    const margin = 16;
    const headerHeight = 100;

    const maxX = Math.max(
      margin,
      app.screen.width - width - margin
    );

    const maxY = Math.max(
      headerHeight,
      app.screen.height - height - margin
    );

    const card = new Container();

    card.position.set(
      margin + Math.random() * Math.max(0, maxX - margin),
      headerHeight +
        Math.random() * Math.max(0, maxY - headerHeight)
    );

    card.alpha = 0;
    card.eventMode = 'static';
    card.cursor = 'pointer';

    const background = new Graphics()
      .roundRect(0, 0, width, height, 14)
      .fill({ color: isCorrect ? 0x153c35 : 0x422c22 })
      .stroke({
        color: isCorrect ? 0x38b99a : 0xec945b,
        width: 2,
      });

    const label = makeText(word, 19);
    label.anchor.set(0.5);
    label.position.set(width / 2, height / 2);

    card.addChild(background, label);
    game.addChild(card);

    const data = {
      card,
      isCorrect,
      age: 0,
      removed: false,
    };

    cards.add(data);

    card.on('pointertap', () => {
      if (!gameRunning || data.removed) return;

      const points = data.isCorrect ? 10 : -5;

      score += points;
      scoreText.text = `Score: ${score}`;

      showFeedback(card.x + width / 2, card.y, points);

      data.removed = true;
      cards.delete(data);

      showTapEffect(card, points);
    });
  }

  function showOverlay(
    titleText,
    detailText,
    buttons,
    subtitleText = ''
  ) {
    removeOverlay();

    overlay = new Container();

    const width = Math.min(360, app.screen.width - 32);
    const height = 340;

    const panel = new Graphics()
      .roundRect(0, 0, width, height, 20)
      .fill({ color: 0x17233a })
      .stroke({ color: 0x38b99a, width: 2 });

    const title = makeText(titleText, 27);
    title.anchor.set(0.5);
    title.position.set(width / 2, 38);

    const detail = makeText(detailText, 17, '#65e6bd');
    detail.anchor.set(0.5);
    detail.position.set(width / 2, 77);

    overlay.addChild(panel, title, detail);

    if (subtitleText) {
      const subtitle = makeText(subtitleText, 13, '#65e6bd');
      subtitle.anchor.set(0.5);
      subtitle.position.set(width / 2, 105);
      overlay.addChild(subtitle);
    }

    let y = subtitleText ? 132 : 112;

    for (const item of buttons) {
      const button = makeButton(
        item.label,
        Math.min(230, width - 40),
        42,
        item.color ?? 0x236c59,
        item.onClick
      );

      button.position.set((width - button.width) / 2, y);
      overlay.addChild(button);

      y += 48;
    }

    overlay.position.set(
      (app.screen.width - width) / 2,
      (app.screen.height - height) / 2
    );

    game.addChild(overlay);
  }

  function startGame() {
    clearCards();
    clearFeedbacks();
    removeOverlay();

    score = 0;
    elapsed = 0;
    spawnElapsed = 0;
    gameRunning = true;

    scoreText.visible = true;
    timerText.visible = true;
    themeText.visible = true;
    progressTrack.visible = true;
    progressFill.visible = true;

    scoreText.text = 'Score: 0';
    timerText.text = 'Time: 30';
    themeText.text =
      `THEME: ${selectedTheme} | LEVEL: ${selectedDifficulty}`;
  }

  function endGame() {
    gameRunning = false;

    clearCards();
    clearFeedbacks();

    const isNewRecord = score > highScore;

    if (isNewRecord) {
      highScore = score;

      try {
        localStorage.setItem(
          'techTapHighScore',
          String(highScore)
        );
      } catch (error) {
        console.warn('Rekor tidak dapat disimpan:', error);
      }
    }

    let resultMessage;

    if (isNewRecord) {
      resultMessage = 'REKOR BARU! Hebat!';
    } else if (score >= 100) {
      resultMessage = 'Luar biasa! Kamu jago teknologi!';
    } else if (score >= 50) {
      resultMessage = 'Bagus! Terus tingkatkan skormu!';
    } else if (score >= 0) {
      resultMessage = 'Coba lagi untuk skor lebih tinggi!';
    } else {
      resultMessage = 'Jangan menyerah! Coba lagi!';
    }

    showOverlay(
      'GAME OVER',
      `Skor: ${score} | Rekor: ${highScore}`,
      [
        {
          label: 'Main Lagi',
          onClick: startGame,
        },
        {
          label: 'Ganti Tema',
          color: 0x344767,
          onClick: showThemeMenu,
        },
        {
          label: 'Menu Utama',
          color: 0x236c59,
          onClick: showStartMenu,
        },
      ],
      resultMessage
    );
  }

  function showThemeMenu() {
    gameRunning = false;

    clearCards();
    clearFeedbacks();

    scoreText.visible = false;
    timerText.visible = false;
    themeText.visible = false;
    progressTrack.visible = false;
    progressFill.visible = false;

    showOverlay(
      'PILIH TEMA',
      'Pilih teknologi yang ingin diuji',
      [
        {
          label: 'Node.js',
          onClick: () => {
            selectedTheme = 'Node.js';
            showDifficultyMenu();
          },
        },
        {
          label: 'PHP',
          onClick: () => {
            selectedTheme = 'PHP';
            showDifficultyMenu();
          },
        },
        {
          label: 'Kembali',
          color: 0x344767,
          onClick: showStartMenu,
        },
      ]
    );
  }

  function showDifficultyMenu() {
    gameRunning = false;

    clearCards();
    clearFeedbacks();

    const descriptions = {
      Easy: 'Kartu 3 detik | Muncul setiap 0,8 detik',
      Medium: 'Kartu 2 detik | Muncul setiap 0,5 detik',
      Hard: 'Kartu 1,2 detik | Muncul setiap 0,35 detik',
    };

    showOverlay(
      'PILIH LEVEL',
      `Tema: ${selectedTheme}`,
      [
        {
          label: 'Easy - Mudah',
          color: 0x236c59,
          onClick: () => {
            selectedDifficulty = 'Easy';
            startGame();
          },
        },
        {
          label: 'Medium - Normal',
          color: 0x8a681e,
          onClick: () => {
            selectedDifficulty = 'Medium';
            startGame();
          },
        },
        {
          label: 'Hard - Sulit',
          color: 0x963e42,
          onClick: () => {
            selectedDifficulty = 'Hard';
            startGame();
          },
        },
        {
          label: 'Kembali',
          color: 0x344767,
          onClick: showThemeMenu,
        },
      ],
      descriptions[selectedDifficulty]
    );
  }

  function showStartMenu() {
    gameRunning = false;

    clearCards();
    clearFeedbacks();

    scoreText.visible = false;
    timerText.visible = false;
    themeText.visible = false;
    progressTrack.visible = false;
    progressFill.visible = false;

    showOverlay(
      'TECH TAP',
      `Rekor tertinggi: ${highScore}`,
      [
        {
          label: 'Mulai Bermain',
          onClick: showThemeMenu,
        },
        {
          label: 'Cara Bermain',
          color: 0x344767,
          onClick: showInstructions,
        },
      ]
    );
  }

  function showInstructions() {
    gameRunning = false;

    clearCards();
    clearFeedbacks();
    removeOverlay();

    const panelWidth = Math.min(380, app.screen.width - 32);
    const panelHeight = 300;
    const panel = new Container();

    const background = new Graphics()
      .roundRect(0, 0, panelWidth, panelHeight, 20)
      .fill({ color: 0x17233a })
      .stroke({ color: 0x38b99a, width: 2 });

    const title = makeText('CARA BERMAIN', 25);
    title.anchor.set(0.5);
    title.position.set(panelWidth / 2, 35);

    const instructions = [
      '1. Pilih tema Node.js atau PHP.',
      '2. Pilih level Easy, Medium, atau Hard.',
      '3. Ketuk kartu sebelum menghilang.',
      '4. Jawaban benar mendapatkan +10.',
      '5. Jawaban salah mengurangi 5 poin.',
      '6. Kumpulkan skor dalam 30 detik!',
    ];

    panel.addChild(background, title);

    instructions.forEach((instruction, index) => {
      const line = makeText(instruction, 13, '#ffffff');
      line.position.set(18, 70 + index * 27);
      panel.addChild(line);
    });

    const backButton = makeButton(
      'Kembali',
      180,
      42,
      0x236c59,
      showStartMenu
    );

    backButton.position.set(
      (panelWidth - 180) / 2,
      240
    );

    panel.addChild(backButton);

    panel.position.set(
      (app.screen.width - panelWidth) / 2,
      (app.screen.height - panelHeight) / 2
    );

    overlay = panel;
    game.addChild(overlay);
  }

  app.ticker.add((ticker) => {
    if (!gameRunning) return;

    const delta = ticker.deltaMS;
    const difficulty = DIFFICULTIES[selectedDifficulty];

    elapsed += delta;
    spawnElapsed += delta;

    const remaining = Math.max(
      0,
      Math.ceil((ROUND_DURATION - elapsed) / 1000)
    );

    timerText.text = `Time: ${remaining}`;

    const barX = 24;
    const barY = 82;
    const barWidth = Math.max(0, app.screen.width - 48);
    const barHeight = 6;

    const progress = Math.max(
      0,
      Math.min(1, 1 - elapsed / ROUND_DURATION)
    );

    progressTrack.clear();
    progressTrack
      .roundRect(barX, barY, barWidth, barHeight, 3)
      .fill({ color: 0x28334a });

    progressFill.clear();

    if (progress > 0) {
      progressFill
        .roundRect(
          barX,
          barY,
          barWidth * progress,
          barHeight,
          3
        )
        .fill({
          color: progress > 0.25 ? 0x38e8a8 : 0xec945b,
        });
    }

    if (elapsed >= ROUND_DURATION) {
      endGame();
      return;
    }

    if (spawnElapsed >= difficulty.spawnInterval) {
      spawnElapsed %= difficulty.spawnInterval;
      spawnCard();
    }

    for (const data of [...cards]) {
      data.age += delta;

      if (data.age >= difficulty.cardLifetime) {
        data.removed = true;
        cards.delete(data);

        data.card.removeFromParent();
        data.card.destroy({ children: true });

        continue;
      }

      const fadeOutStart =
        difficulty.cardLifetime - FADE_OUT_DURATION;

      if (data.age < FADE_IN_DURATION) {
        data.card.alpha = data.age / FADE_IN_DURATION;
      } else if (data.age > fadeOutStart) {
        data.card.alpha = Math.max(
          0,
          (difficulty.cardLifetime - data.age) / FADE_OUT_DURATION
        );
      } else {
        data.card.alpha = 1;
      }
    }
  });

  showStartMenu();
}

main().catch((error) => {
  console.error('Gagal menjalankan Tech Tap:', error);
});
