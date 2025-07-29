// --- Core Game Constants ---
const GAME_WIDTH = 640;
const GAME_HEIGHT = 400;
const SCENES_PER_STAGE = 10;
const STAGES_PER_LEVEL = 10;
const PLAYER_SPEED = 3.5;
const PLAYER_JUMP = -8;
const GRAVITY = 0.32;
const ENEMY_SPEED = 1.2; // Slower enemy speed
const ENEMY_SIZE = 32;
const PLAYER_SIZE = 36;
const FLOOR_Y = GAME_HEIGHT - 48;
const COLORS = {
    coop: '#ffe066',
    fudmonster: '#e17055',
    miniboss: '#a29bfe',
    boss: '#00b894',
    health: '#00b894',
    bg1: '#cad3c8',
    bg2: '#aaa69d'
};

// --- Coop Sprite Animation: Walking Left ---
const COOP_WALK_LEFT_FRAMES = [
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Coop_walk_left_1_1753755399811.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Coop_walk_left_2_1753755415493.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Coop_walk_left_3_1753755438859.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Coop_walk_left_4_1753755459773.png",
    "https://dcnmwoxzefwqmvvkpqap.supabase.co/storage/v1/object/public/sprite-studio-exports/0f84fe06-5c42-40c3-b563-1a28d18f37cc/library/Coop_walk_left_5_1753755468791.png"
];

// Preload images and create mirrored Image objects for right-facing using safe crossOrigin
function loadCoopSprites() {
    const left = [];
    const right = [];
    let loaded = 0;
    return new Promise((resolve) => {
        COOP_WALK_LEFT_FRAMES.forEach((src, i) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Set crossOrigin to avoid canvas tainting
            img.src = src;
            img.onload = () => {
                left[i] = img;
                // Create a mirrored version in a canvas for right-walk
                try {
                    const c = document.createElement('canvas');
                    c.width = img.width;
                    c.height = img.height;
                    const ctx = c.getContext('2d');
                    ctx.save();
                    ctx.translate(img.width, 0);
                    ctx.scale(-1, 1);
                    ctx.drawImage(img, 0, 0);
                    ctx.restore();
                    const mirrored = new Image();
                    mirrored.src = c.toDataURL();
                    mirrored.onload = () => {
                        right[i] = mirrored;
                        loaded++;
                        if (loaded === COOP_WALK_LEFT_FRAMES.length) {
                            resolve({ left, right });
                        }
                    };
                } catch (e) {
                    // If canvas is tainted, just use the left sprite for right as fallback
                    right[i] = img;
                    loaded++;
                    if (loaded === COOP_WALK_LEFT_FRAMES.length) {
                        resolve({ left, right });
                    }
                }
            };
            img.onerror = () => {
                // Fallback: create dummy blank image
                const fallback = document.createElement('canvas');
                fallback.width = PLAYER_SIZE;
                fallback.height = PLAYER_SIZE;
                const fallbackImg = new Image();
                fallbackImg.src = fallback.toDataURL();
                left[i] = fallbackImg;
                right[i] = fallbackImg;
                loaded++;
                if (loaded === COOP_WALK_LEFT_FRAMES.length) {
                    resolve({ left, right });
                }
            };
        });
    });
}

window.addEventListener('DOMContentLoaded', initGame);

function initGame() {
    const container = document.getElementById('gameContainer');
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    container.appendChild(canvas);

    // Preload Coop walk sprites (left & right/mirrored)
    loadCoopSprites().then(sprites => {
        // Instantiate and start the game!
        const game = new Game(canvas, sprites);
        game.render();
    });
}

// --- Utility ---
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

// --- Player Class ---
class Player {
    constructor(x, y, coopSprites) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.color = COLORS.coop;
        this.isOnGround = false;
        this.facing = 1; // 1: right, -1: left
        this.health = 8;
        this.maxHealth = 8;
        this.attackCooldown = 0;
        this.isAttacking = false;
        this.attackFrame = 0;
        // Animation
        this.walkFrame = 0;
        this.walkAnimSpeed = 6;
        this.walkAnimCounter = 0;
        this.coopSprites = coopSprites || { left: [], right: [] };
        this.isMoving = false;
    }

    update(input) {
        let wasMoving = this.isMoving;
        // Move left/right
        if (input.left) {
            this.vx = -PLAYER_SPEED;
            this.facing = -1;
            this.isMoving = true;
        } else if (input.right) {
            this.vx = PLAYER_SPEED;
            this.facing = 1;
            this.isMoving = true;
        } else {
            this.vx = 0;
            this.isMoving = false;
        }

        // Walk Animation Frame
        if (this.isMoving) {
            this.walkAnimCounter++;
            if (this.walkAnimCounter >= this.walkAnimSpeed) {
                this.walkAnimCounter = 0;
                this.walkFrame = (this.walkFrame + 1) % this.coopSprites.left.length;
            }
        } else if (wasMoving) {
            // Reset to idle frame when stopping
            this.walkFrame = 0;
            this.walkAnimCounter = 0;
        }

        // Jump
        if (input.jump && this.isOnGround) {
            this.vy = PLAYER_JUMP;
            this.isOnGround = false;
        }

        // Attack
        if ((input.attack || input.attackAlt) && !this.isAttacking && this.attackCooldown <= 0) {
            this.isAttacking = true;
            this.attackFrame = 0;
            this.attackCooldown = 16;
        }

        // Gravity
        this.vy += GRAVITY;

        // Position
        this.x += this.vx;
        this.y += this.vy;

        // Floor collision
        if (this.y + this.height > FLOOR_Y) {
            this.y = FLOOR_Y - this.height;
            this.vy = 0;
            this.isOnGround = true;
        }

        // Clamp to screen
        this.x = clamp(this.x, 0, GAME_WIDTH - this.width);

        if (this.attackCooldown > 0) this.attackCooldown--;
        if (this.isAttacking) {
            this.attackFrame++;
            if (this.attackFrame > 10) {
                this.isAttacking = false;
            }
        }
    }

    attackBox() {
        // Sword swing in facing direction
        if (!this.isAttacking) return null;
        return {
            x: this.facing === 1 ? this.x + this.width - 4 : this.x - 18,
            y: this.y + 8,
            width: 22,
            height: 20
        };
    }

    draw(ctx) {
        ctx.save();
        // --- Sprite Animation ---
        // Draw animated Coop sprite if moving, else fallback to draw shape
        let drewSprite = false;
        // Use idle as first walk frame
        let frameIdx = 0;
        if (this.isMoving && this.coopSprites.left.length > 0) {
            frameIdx = this.walkFrame % this.coopSprites.left.length;
        }
        // Use first walk frame as idle
        if (!this.isMoving && this.coopSprites.left.length > 0) {
            frameIdx = 0;
        }
        let img;
        if (this.facing === -1 && this.coopSprites.left.length > 0) {
            img = this.coopSprites.left[frameIdx];
        } else if (this.facing === 1 && this.coopSprites.right.length > 0) {
            img = this.coopSprites.right[frameIdx];
        }
        if (img) {
            ctx.drawImage(
                img,
                this.x - 6, // Slight offset to center sprite
                this.y - 2,
                this.width + 12, // Adjusted to fit sprite size
                this.height + 6
            );
            drewSprite = true;
        }

        if (!drewSprite) {
            // Coop: yellow oval with blue cap and a bandana
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowColor = '#fffbbf';
            ctx.shadowBlur = 8;
            ctx.fill();
            ctx.shadowBlur = 0;
            // Eyes
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2 - 7, this.y + this.height / 2 - 4, 3, 0, Math.PI * 2);
            ctx.arc(this.x + this.width / 2 + 7, this.y + this.height / 2 - 4, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#222';
            ctx.fill();
            // Bandana
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y + 7);
            ctx.lineTo(this.x + this.width / 2 + 11, this.y + 2);
            ctx.lineTo(this.x + this.width / 2 + 8, this.y + 11);
            ctx.closePath();
            ctx.fillStyle = '#1976d2';
            ctx.fill();
        }
        // Sword (during attack)
        if (this.isAttacking) {
            ctx.save();
            ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
            ctx.rotate(this.facing * (Math.PI/7));
            ctx.fillStyle = '#b2bec3';
            ctx.fillRect(12, -2, 16, 4);
            ctx.restore();
        }
        ctx.restore();
    }

    drawHealth(ctx, x, y) {
        ctx.save();
        for (let i = 0; i < this.maxHealth; i++) {
            ctx.beginPath();
            ctx.arc(x + i * 20, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = i < this.health ? COLORS.health : '#b2bec3';
            ctx.fill();
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}

// --- Enemy Class ---
class Enemy {
    constructor(x, y, type, health) {
        this.x = x;
        this.y = y;
        this.type = type || 'fudmonster';
        this.width = ENEMY_SIZE;
        this.height = ENEMY_SIZE;
        this.facing = -1; // faces left by default
        this.vx = 0;
        this.vy = 0;
        this.health = health || 3;
        this.maxHealth = health || 3;
        this.isAttacking = false;
        this.attackFrame = 0;
        this.knockback = 0;
        this.knockbackVx = 0;
        // Animation
        this.walkFrame = 0;
        this.walkAnimCounter = 0;
    }

    update(player) {
        if (this.health <= 0) return;

        // Knockback
        if (this.knockback !== 0) {
            this.x += this.knockbackVx;
            this.knockback *= 0.7;
            this.knockbackVx *= 0.7;
            if (Math.abs(this.knockback) < 1) {
                this.knockback = 0;
                this.knockbackVx = 0;
            }
            return;
        }

        // Move towards player if not attacking
        let dx = player.x - this.x;
        let dy = player.y - this.y;
        this.facing = dx > 0 ? 1 : -1;

        let speed = ENEMY_SPEED;
        switch (this.type) {
            case 'miniboss': speed = ENEMY_SPEED * 1.15; break;
            case 'boss': speed = ENEMY_SPEED * 1.3; break;
        }

        if (!this.isAttacking && Math.abs(dx) > 24) {
            this.x += speed * this.facing;
        }

        // Jump down if above player
        if (Math.abs(dy) > 10) {
            this.y += dy > 0 ? speed * 0.66 : -speed * 0.66;
        }

        // Attack logic
        if (!this.isAttacking && Math.abs(dx) < 36 && Math.abs(dy) < 20) {
            this.isAttacking = true;
            this.attackFrame = 0;
        }

        if (this.isAttacking) {
            this.attackFrame++;
            if (this.attackFrame > 18) {
                this.isAttacking = false;
                this.attackFrame = 0;
            }
        }

        // Clamp to floor
        if (this.y + this.height > FLOOR_Y) {
            this.y = FLOOR_Y - this.height;
            this.vy = 0;
        }
        // Clamp to screen
        this.x = clamp(this.x, 0, GAME_WIDTH - this.width);

        // Animation
        this.walkAnimCounter++;
        if (this.walkAnimCounter > 7) {
            this.walkAnimCounter = 0;
            this.walkFrame = (this.walkFrame + 1) % 4;
        }
    }

    attackBox() {
        if (!this.isAttacking || this.health <= 0) return null;
        return {
            x: this.facing === 1 ? this.x + this.width - 8 : this.x - 16,
            y: this.y + 10,
            width: 20,
            height: 18
        };
    }

    draw(ctx) {
        ctx.save();
        // Enemy body
        ctx.beginPath();
        ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, Math.PI*2);
        switch(this.type) {
            case 'fudmonster': ctx.fillStyle = COLORS.fudmonster; break;
            case 'miniboss': ctx.fillStyle = COLORS.miniboss; break;
            case 'boss': ctx.fillStyle = COLORS.boss; break;
        }
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 4;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Eyes
        ctx.beginPath();
        ctx.arc(this.x + this.width/2 - 6, this.y + this.height/2 - 7, 3, 0, Math.PI*2);
        ctx.arc(this.x + this.width/2 + 6, this.y + this.height/2 - 7, 3, 0, Math.PI*2);
        ctx.fillStyle = '#222';
        ctx.fill();
        // Mouth
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2 + 4, 5, 0, Math.PI);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#222';
        ctx.stroke();
        // Attack swing
        if (this.isAttacking && this.attackFrame < 10) {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.facing * Math.PI/6);
            ctx.fillStyle = '#d35400';
            ctx.fillRect(10, -2, 16, 4);
            ctx.restore();
        }
        ctx.restore();
    }

    drawHealth(ctx, x, y) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y-8, 100, 12);
        ctx.fillStyle = "#333";
        ctx.fill();
        ctx.beginPath();
        ctx.rect(x, y-8, 100*(this.health/this.maxHealth), 12);
        switch(this.type) {
            case 'miniboss': ctx.fillStyle = COLORS.miniboss; break;
            case 'boss': ctx.fillStyle = COLORS.boss; break;
            default: ctx.fillStyle = COLORS.fudmonster;
        }
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y-8, 100, 12);
        ctx.restore();
    }
}

// --- Game Class ---
class Game {
    constructor(canvas, coopSprites) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.state = 'menu'; // menu, playing, stageClear, levelClear, gameOver
        this.input = { left: false, right: false, jump: false, attack: false, attackAlt: false };
        this.scene = 1;
        this.stage = 1;
        this.level = 1;
        this.player = null;
        this.enemies = [];
        this.sceneTimer = 0;
        this.stageTimer = 0;
        this.bossDefeated = false;
        this.messageTimer = 0;
        this.lastTimestamp = 0;
        this.keysDown = {};
        this.coopSprites = coopSprites || { left: [], right: [] };
        this.initInput();
    }

    startGame() {
        this.state = 'playing';
        this.scene = 1;
        this.stage = 1;
        this.level = 1;
        this.player = new Player(60, FLOOR_Y - PLAYER_SIZE, this.coopSprites);
        this.enemies = [];
        this.spawnEnemies();
        this.sceneTimer = 0;
        this.stageTimer = 0;
        this.bossDefeated = false;
        this.render();
    }

    nextScene() {
        this.scene++;
        if (this.scene > SCENES_PER_STAGE) {
            this.scene = 1;
            this.stage++;
            if (this.stage > STAGES_PER_LEVEL) {
                this.stage = 1;
                this.level++;
                this.state = 'levelClear';
                this.messageTimer = 120;
                this.render();
                return;
            } else {
                this.state = 'stageClear';
                this.messageTimer = 80;
                this.render();
                return;
            }
        }
        this.player.x = 60;
        this.player.y = FLOOR_Y - PLAYER_SIZE;
        this.enemies = [];
        this.spawnEnemies();
        this.bossDefeated = false;
        this.render();
    }

    spawnEnemies() {
        this.enemies = [];
        if (this.stage === STAGES_PER_LEVEL && this.scene === SCENES_PER_STAGE) {
            // Main boss
            this.enemies.push(new Enemy(400, FLOOR_Y - ENEMY_SIZE, 'boss', 16 + this.level * 2));
        } else if (this.scene === SCENES_PER_STAGE) {
            // Mini boss
            this.enemies.push(new Enemy(440, FLOOR_Y - ENEMY_SIZE, 'miniboss', 8 + this.level));
        } else {
            // Random number of normal fudmonsters
            let count = 1 + Math.floor(Math.random() * 2 + this.level * 0.3);
            for (let i = 0; i < count; i++) {
                this.enemies.push(new Enemy(
                    330 + Math.random() * 180,
                    FLOOR_Y - ENEMY_SIZE,
                    'fudmonster',
                    2 + this.level + Math.floor(Math.random() * 2)
                ));
            }
        }
    }

    update() {
        if (this.state !== 'playing') return;
        this.player.update(this.input);

        for (let enemy of this.enemies) {
            enemy.update(this.player);
        }

        // Collision, scene advance, game state etc.
        const pBox = this.player.attackBox();
        if (pBox) {
            for (let enemy of this.enemies) {
                if (rectsOverlap(pBox, enemy)) {
                    if (enemy.health > 0) {
                        enemy.health--;
                        enemy.isAttacking = false;
                        // Knockback enemy
                        enemy.knockback = 10 * this.player.facing;
                        enemy.knockbackVx = 4 * this.player.facing;
                        if (enemy.health <= 0) {
                            enemy.health = 0;
                        }
                    }
                }
            }
        }

        // Collision: enemy attacks player
        for (let enemy of this.enemies) {
            const eBox = enemy.attackBox();
            if (eBox && rectsOverlap(eBox, this.player)) {
                if (this.player.health > 0) {
                    // Less damage per hit for enemies
                    let dmg = 1;
                    if (enemy.type === 'miniboss') dmg = 2;
                    if (enemy.type === 'boss') dmg = 3;
                    this.player.health -= dmg;
                    this.player.x -= 12 * enemy.facing;
                    if (this.player.health <= 0) {
                        this.player.health = 0;
                        this.state = 'gameOver';
                        this.messageTimer = 140;
                    }
                }
            }
        }

        // Remove defeated enemies
        this.enemies = this.enemies.filter(e => e.health > 0);

        // If no enemies left, advance after a moment
        if (this.enemies.length === 0) {
            this.sceneTimer++;
            if (this.sceneTimer > 38) {
                this.sceneTimer = 0;
                // If main boss defeated
                if (this.stage === STAGES_PER_LEVEL && this.scene === SCENES_PER_STAGE) {
                    this.state = 'levelClear';
                    this.messageTimer = 120;
                }
                // If mini boss defeated
                else if (this.scene === SCENES_PER_STAGE) {
                    this.state = 'stageClear';
                    this.messageTimer = 80;
                }
                else {
                    this.nextScene();
                    return;
                }
            }
        }
    }

    render(timestamp) {
        if (!timestamp) timestamp = 0;
        this.lastTimestamp = timestamp;
        // Game logic
        if (this.state === 'playing') {
            this.update();
        }

        // Draw
        this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        this.drawBackground();

        if (this.state === 'menu') {
            this.drawMenu();
        } else {
            // HUD
            this.drawHUD();

            // Floor
            this.ctx.save();
            this.ctx.fillStyle = '#2d3436';
            this.ctx.fillRect(0, FLOOR_Y, GAME_WIDTH, GAME_HEIGHT - FLOOR_Y);
            this.ctx.restore();

            // Player & Enemies
            this.player.draw(this.ctx);
            let enemyY = 26;
            for (let enemy of this.enemies) {
                enemy.draw(this.ctx);
                // Show enemy health for bosses/minibosses
                if (enemy.type !== 'fudmonster') {
                    enemy.drawHealth(this.ctx, GAME_WIDTH - 130, enemyY);
                    enemyY += 22;
                }
            }

            // Scene/Stage/Level label
            this.ctx.save();
            this.ctx.font = "bold 18px sans-serif";
            this.ctx.fillStyle = "#222";
            this.ctx.globalAlpha = 0.12;
            this.ctx.fillText(`Level ${this.level} - Stage ${this.stage} - Scene ${this.scene}`, 30, 40);
            this.ctx.globalAlpha = 1.0;
            this.ctx.restore();

            // Clear/Win/Loss messages
            if (this.state === 'stageClear') {
                this.ctx.save();
                this.ctx.fillStyle = "#fff";
                this.ctx.font = "bold 34px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.globalAlpha = Math.min(1, this.messageTimer / 40);
                this.ctx.fillText("Stage Cleared!", GAME_WIDTH/2, GAME_HEIGHT/2 - 18);
                this.ctx.font = "18px sans-serif";
                this.ctx.globalAlpha = 1;
                this.ctx.fillText("Press [Space] to continue", GAME_WIDTH/2, GAME_HEIGHT/2 + 18);
                this.ctx.restore();
            }
            if (this.state === 'levelClear') {
                this.ctx.save();
                this.ctx.fillStyle = "#fff";
                this.ctx.font = "bold 32px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.globalAlpha = Math.min(1, this.messageTimer / 40);
                this.ctx.fillText("Level Completed!", GAME_WIDTH/2, GAME_HEIGHT/2 - 16);
                this.ctx.font = "18px sans-serif";
                this.ctx.globalAlpha = 1;
                this.ctx.fillText("Press [Space] for Next Level", GAME_WIDTH/2, GAME_HEIGHT/2 + 18);
                this.ctx.restore();
            }
            if (this.state === 'gameOver') {
                this.ctx.save();
                this.ctx.fillStyle = "#fff";
                this.ctx.font = "bold 36px sans-serif";
                this.ctx.textAlign = "center";
                this.ctx.globalAlpha = Math.min(1, this.messageTimer / 60);
                this.ctx.fillText("GAME OVER", GAME_WIDTH/2, GAME_HEIGHT/2 - 10);
                this.ctx.font = "18px sans-serif";
                this.ctx.globalAlpha = 1;
                this.ctx.fillText("Press [R] to Retry", GAME_WIDTH/2, GAME_HEIGHT/2 + 20);
                this.ctx.restore();
            }
        }

        // Message timer for screens
        if (this.messageTimer > 0) {
            this.messageTimer--;
        } else {
            // Allow advancing on space/enter for clears
            if ((this.state === 'stageClear' || this.state === 'levelClear') && this.keysDown[' ']) {
                if (this.state === 'stageClear') {
                    this.state = 'playing';
                    this.nextScene();
                } else {
                    // New level
                    this.state = 'playing';
                    this.scene = 1;
                    this.stage = 1;
                    this.level++;
                    this.player = new Player(60, FLOOR_Y - PLAYER_SIZE, this.coopSprites);
                    this.spawnEnemies();
                }
            }
            if (this.state === 'gameOver' && this.keysDown['r']) {
                this.startGame();
            }
        }
        requestAnimationFrame(this.render.bind(this));
    }

    drawMenu() {
        this.ctx.save();
        this.ctx.font = "bold 38px sans-serif";
        this.ctx.textAlign = "center";
        this.ctx.fillStyle = "#fff";
        this.ctx.fillText("Coop vs Fudmonsters", GAME_WIDTH/2, 108);
        this.ctx.font = "22px sans-serif";
        this.ctx.fillText("A side-scrolling beat 'em up", GAME_WIDTH/2, 146);
        this.ctx.font = "16px sans-serif";
        this.ctx.fillStyle = "#e17055";
        this.ctx.fillText("Arrow keys/WASD: Move  |  Z/Space: Jump  |  X/Space: Attack", GAME_WIDTH/2, 205);
        this.ctx.fillStyle = "#00b894";
        this.ctx.fillText("Space: Start", GAME_WIDTH/2, 235);
        this.ctx.restore();
    }

    drawHUD() {
        // Draw health bar
        this.player.drawHealth(this.ctx, 30, 30);
    }

    drawBackground() {
        // Simple parallax scrolling
        this.ctx.save();
        // Sky
        this.ctx.fillStyle = COLORS.bg1;
        this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        // Distant hills
        this.ctx.globalAlpha = 0.35;
        this.ctx.fillStyle = COLORS.bg2;
        for (let i = 0; i < 4; i++) {
            this.ctx.beginPath();
            this.ctx.arc(120 + i * 180, GAME_HEIGHT - 86, 90, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        // Closer hills
        this.ctx.globalAlpha = 0.18;
        this.ctx.fillStyle = "#222f3e";
        for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.arc(80 + i * 240, GAME_HEIGHT - 46, 60, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    // --- Input ---
    initInput() {
        window.addEventListener('keydown', (e) => {
            this.keysDown[e.key.toLowerCase()] = true;
            if (this.state === 'menu' && (e.key === ' ' || e.key === 'Enter')) {
                this.startGame();
            }
            if (this.state === 'stageClear' || this.state === 'levelClear') {
                if (e.key === ' ') this.keysDown[' '] = true;
            }
            if (this.state === 'gameOver') {
                if (e.key.toLowerCase() === 'r') this.keysDown['r'] = true;
            }
            // In-game movement
            if (this.state === 'playing') {
                if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') this.input.left = true;
                if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.input.right = true;
                if (e.key.toLowerCase() === 'z' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') this.input.jump = true;
                if (e.key.toLowerCase() === 'x') this.input.attack = true;
                if (e.key === ' ') this.input.attackAlt = true;
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keysDown[e.key.toLowerCase()] = false;
            if (e.key === ' ') this.keysDown[' '] = false;
            if (e.key.toLowerCase() === 'r') this.keysDown['r'] = false;
            if (this.state === 'playing') {
                if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') this.input.left = false;
                if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') this.input.right = false;
                if (e.key.toLowerCase() === 'z' || e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') this.input.jump = false;
                if (e.key.toLowerCase() === 'x') this.input.attack = false;
                if (e.key === ' ') this.input.attackAlt = false;
            }
        });
        // Prevent arrow keys and space from scrolling page
        window.addEventListener('keydown', function(e) {
            if (["ArrowLeft","ArrowRight","ArrowUp"," ","a","d","w"].includes(e.key)) {
                e.preventDefault();
            }
        }, false);
    }
}

// --- Helper: Rectangle collision ---
function rectsOverlap(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}