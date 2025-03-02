// Supabase Configuration
// Replace these with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://qdslrhirgrwqfyouoori.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkc2xyaGlyZ3J3cWZ5b3Vvb3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4ODc2OTIsImV4cCI6MjA1NjQ2MzY5Mn0.BTEKKXY_twIIo1w6FqW';
let supabase;
// Variable to track real-time subscription
let leaderboardSubscription = null;
// Flag to track if we're running on GitHub Pages
const isGitHubPages = window.location.hostname.includes('github.io');
// Flag to use offline mode when Supabase is unavailable
let useOfflineMode = isGitHubPages; // Default to offline mode on GitHub Pages

// Add these helper functions at the top of the file, after the global variables
function drawRetroText(text, x, y, size, mainColor, outlineColor, shadowColor) {
  push();
  textSize(size);
  textAlign(CENTER, CENTER);
  
  // Shadow
  fill(shadowColor);
  text(text, x + 3, y + 3);
  
  // Outline
  fill(outlineColor);
  text(text, x - 2, y);
  text(text, x + 2, y);
  text(text, x, y - 2);
  text(text, x, y + 2);
  
  // Main text with gradient
  fill(mainColor);
  text(text, x, y);
  pop();
}

function drawGradientText(text, x, y, size, colorTop, colorBottom) {
  push();
  textSize(size);
  textAlign(CENTER, CENTER);
  
  // Create a temporary graphics buffer for the gradient text
  let pg = createGraphics(textWidth(text) + 20, size * 1.5);
  pg.textFont('Orbitron');
  pg.textSize(size);
  pg.textAlign(CENTER, CENTER);
  
  // Create gradient
  let gradient = pg.drawingContext.createLinearGradient(0, 0, 0, size * 1.5);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  
  pg.drawingContext.fillStyle = gradient;
  pg.text(text, pg.width / 2, pg.height / 2);
  
  // Draw the gradient text to the main canvas
  image(pg, x - pg.width / 2, y - pg.height / 2);
  
  pop();
}

function setup() {
  createCanvas(1040, 740);
  pixelDensity(1); // Set pixel density to 1 to avoid rendering issues
  background(0); // Ensure the canvas starts with a black background
  
  // Initialize Supabase client
  try {
    console.log("Attempting to initialize Supabase with URL:", SUPABASE_URL);
    
    // Check if we're on GitHub Pages
    if (isGitHubPages) {
      console.log("Running on GitHub Pages - using offline mode for leaderboard");
      useOfflineMode = true;
    }
    
    // Initialize Supabase client
    supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("Supabase initialized successfully");
    
    // Test connection only if not in offline mode
    if (!useOfflineMode) {
      supabase.from('leaderboard').select('count').limit(1)
        .then(response => {
          if (response.error) {
            console.error("Supabase connection test failed:", response.error);
            useOfflineMode = true;
            console.log("Switching to offline mode for leaderboard");
          } else {
            console.log("Supabase connection test successful:", response);
            // Set up real-time subscription for leaderboard updates
            setupRealtimeSubscription();
          }
        })
        .catch(error => {
          console.error("Supabase connection test error:", error);
          useOfflineMode = true;
          console.log("Switching to offline mode for leaderboard due to error");
        });
    }
  } catch (error) {
    console.error("Error initializing Supabase:", error);
    useOfflineMode = true;
  }
  
  game = new Game();
  
  // Add error handling for the main game loop, but only for critical errors
  window.onerror = function(message, source, lineno, colno, error) {
    console.error(`Game error at line ${lineno}:`, message);
    
    // Log the error but don't change game state
    // This prevents the game from ending prematurely
    console.log("Error detected, but continuing game");
    
    return true; // Prevents the default browser error handling
  };
}

function draw() {
  try {
    // Clear the background first to prevent rendering artifacts
    background(0); // Black space background
    
    // Update game state
    if (game.state === 'playing') {
    game.update();
    }
    
    // Draw game
    game.draw();
  } catch (error) {
    console.error("Error in main game loop:", error);
  }
}

// Function to set up real-time subscription for leaderboard updates
function setupRealtimeSubscription() {
  try {
    // Clean up any existing subscription
    if (leaderboardSubscription) {
      leaderboardSubscription.unsubscribe();
    }
    
    // Subscribe to changes on the leaderboard table
    leaderboardSubscription = supabase
      .channel('leaderboard-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'leaderboard' }, 
        payload => {
          console.log('Leaderboard change received!', payload);
          // Refresh leaderboard data when changes occur
          if (game && game.state === 'leaderboard') {
            game.fetchLeaderboard();
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });
      
    console.log('Realtime subscription set up successfully');
  } catch (error) {
    console.error('Error setting up realtime subscription:', error);
  }
}

// Player Class
class Player {
    constructor() {
      this.width = 60;
      this.height = 40;
      this.x = width / 2;
      this.y = height - 30;
      this.shooting = false;
      this.shootCooldown = 10; // frames
      this.cooldown = 0;
      this.powerLevel = 0; // 0: normal, 1: double shot, 2: triple shot
      this.powerupTimer = 0;
      this.powerupDuration = 300; // 5 seconds at 60fps
      this.thrusterAnimation = 0;
      this.shieldActive = false;
      this.shieldHealth = 0;
      this.invincible = false;
      this.invincibleTimer = 0;
      this.lastPowerupTime = 0; // Track when the last powerup was collected
      this.speed = 2; // Base speed of the spaceship
      this.lives = 3; // Maximum of 3 lives
    }
  
    update() {
      // Update position based on mouse with speed factor
      let targetX = mouseX;
      let dx = targetX - this.x;
      this.x += dx * 0.1 * this.speed; // Apply speed factor to movement
      this.x = constrain(this.x, this.width / 2, width - this.width / 2);
      
      // Update thruster animation
      this.thrusterAnimation += 0.2;
      
      // Handle shooting
      if (this.shooting && this.cooldown <= 0) {
        this.shoot();
        this.cooldown = this.shootCooldown;
      }
      if (this.cooldown > 0) {
        this.cooldown--;
      }
      
      // Update powerup timer with visual feedback
      if (this.powerLevel > 0 && this.powerupTimer > 0) {
        this.powerupTimer--;
        // Flash when powerup is about to expire
        if (this.powerupTimer < 60 && frameCount % 10 < 5) {
          // Visual feedback will be handled in draw method
        }
        if (this.powerupTimer <= 0) {
          this.powerLevel = 0;
        }
      }
      
      // Update invincibility
      if (this.invincible) {
        this.invincibleTimer--;
        if (this.invincibleTimer <= 0) {
          this.invincible = false;
        }
      }
    }
    
    // Increase speed when leveling up
    increaseSpeed() {
      // Increase speed by 50% each level (exponential growth)
      this.speed = this.speed * 1.5;
      console.log("Player speed increased to:", this.speed);
    }
  
    shoot() {
      try {
        if (this.powerLevel === 0) {
          // Single shot
          if (game && game.bullets) {
            game.bullets.push(new Bullet(this.x, this.y - this.height / 2));
          }
        } else if (this.powerLevel === 1) {
          // Double shot
          if (game && game.bullets) {
            game.bullets.push(new Bullet(this.x - 10, this.y - this.height / 3));
            game.bullets.push(new Bullet(this.x + 10, this.y - this.height / 3));
          }
        } else if (this.powerLevel === 2) {
          // Triple shot
          if (game && game.bullets) {
            game.bullets.push(new Bullet(this.x, this.y - this.height / 2));
            game.bullets.push(new Bullet(this.x - 15, this.y - this.height / 3));
            game.bullets.push(new Bullet(this.x + 15, this.y - this.height / 3));
          }
        }
      } catch (error) {
        console.error("Error in shoot method:", error);
        // Don't reset the game here, just log the error
      }
    }
  
    activatePowerup(level) {
      this.powerLevel = level;
      this.powerupTimer = this.powerupDuration;
      this.lastPowerupTime = millis(); // Record when powerup was collected
    }
    
    activateShield() {
      this.shieldActive = true;
      this.shieldHealth = 2;
      this.lastPowerupTime = millis(); // Record when shield was collected
    }
    
    hitByEnemy() {
      try {
        // If player has shield active, absorb the hit
        if (this.shieldActive) {
          console.log("Shield absorbed hit");
          this.shieldHealth--;
          if (this.shieldHealth <= 0) {
            this.shieldActive = false;
          }
          return false; // Player didn't die
        }
        
        // If player is invincible, ignore the hit
        if (this.invincible) {
          console.log("Player is invincible - no damage taken");
          return false; // Player is invincible
        }
        
        // Reduce lives and check for game over
        this.lives--;
        console.log("Player hit! Lives remaining:", this.lives);
        
        if (this.lives <= 0) {
          this.lives = 0; // Ensure lives don't go negative
          console.log("Player has no lives left - GAME OVER");
          return true; // Player died, game over
        } else {
          // Player still has lives, make invincible briefly
          this.invincible = true;
          this.invincibleTimer = 120; // 2 seconds at 60fps
          return false; // Player didn't die
        }
      } catch (error) {
        console.error("Error in hitByEnemy:", error);
        return false; // Default to not dying on error
      }
    }
  
    draw() {
      push();
      translate(this.x, this.y);
      
      // Draw shield if active
      if (this.shieldActive) {
        noFill();
        // Animated shield effect
        let shieldPulse = sin(frameCount * 0.1) * 50;
        let shieldAlpha = 150 + shieldPulse;
        
        // Outer shield glow
        stroke(0, 200, 255, shieldAlpha * 0.5);
        strokeWeight(5);
        ellipse(0, -this.height / 4, this.width + 30, this.height + 30);
        
        // Inner shield
        stroke(0, 200, 255, shieldAlpha);
        strokeWeight(3);
        ellipse(0, -this.height / 4, this.width + 20, this.height + 20);
        
        // Shield energy lines
        stroke(255, 255, 255, shieldAlpha * 0.7);
        strokeWeight(1);
        for (let i = 0; i < 8; i++) {
          let angle = i * PI / 4 + frameCount * 0.02;
          let radius = this.width / 2 + 10;
          let x1 = cos(angle) * radius;
          let y1 = sin(angle) * radius - this.height / 4;
          let x2 = cos(angle) * (radius + 5 + sin(frameCount * 0.1 + i) * 3);
          let y2 = sin(angle) * (radius + 5 + sin(frameCount * 0.1 + i) * 3) - this.height / 4;
          line(x1, y1, x2, y2);
        }
        
        noStroke();
      }
      
      // Flashing effect when invincible
      if (this.invincible && frameCount % 6 >= 3) {
        // Skip drawing the ship every few frames for flashing effect
        pop();
        return;
      }
      
      // Engine glow effect
      let thrusterFlicker = sin(this.thrusterAnimation) * 5;
      let engineGlowSize = 20 + thrusterFlicker;
      
      // Engine glow
      fill(255, 100, 0, 100);
      ellipse(0, this.height / 3, engineGlowSize * 1.5, engineGlowSize);
      fill(255, 150, 0, 150);
      ellipse(0, this.height / 3, engineGlowSize, engineGlowSize * 0.7);
      
      // Main body - sleeker design with gradient effect
      let bodyColor1 = color(50, 130, 220); // Base blue
      let bodyColor2 = color(70, 150, 240); // Lighter blue
      
      // Main hull
      fill(bodyColor1);
      beginShape();
      vertex(-this.width / 2, 0);
      vertex(-this.width / 4, -this.height / 2);
      vertex(0, -this.height * 0.7);
      vertex(this.width / 4, -this.height / 2);
      vertex(this.width / 2, 0);
      vertex(this.width / 3, this.height / 4);
      vertex(-this.width / 3, this.height / 4);
      endShape(CLOSE);
      
      // Hull details - add some accent lines
      stroke(20, 80, 180);
      strokeWeight(1.5);
      line(-this.width / 4, -this.height / 2, -this.width / 6, this.height / 4);
      line(this.width / 4, -this.height / 2, this.width / 6, this.height / 4);
      line(0, -this.height * 0.7, 0, this.height / 4);
      noStroke();
      
      // Wings with more detail
      fill(30, 100, 180);
      
      // Left wing
      beginShape();
      vertex(-this.width / 3, -this.height / 4);
      vertex(-this.width * 0.7, -this.height / 8);
      vertex(-this.width * 0.8, this.height / 10);
      vertex(-this.width * 0.7, this.height / 6);
      vertex(-this.width / 3, this.height / 4);
      endShape(CLOSE);
      
      // Right wing
      beginShape();
      vertex(this.width / 3, -this.height / 4);
      vertex(this.width * 0.7, -this.height / 8);
      vertex(this.width * 0.8, this.height / 10);
      vertex(this.width * 0.7, this.height / 6);
      vertex(this.width / 3, this.height / 4);
      endShape(CLOSE);
      
      // Wing details
      stroke(20, 80, 180);
      strokeWeight(1.5);
      line(-this.width * 0.7, -this.height / 8, -this.width * 0.7, this.height / 6);
      line(this.width * 0.7, -this.height / 8, this.width * 0.7, this.height / 6);
      
      // Wing tips with energy glow
      noStroke();
      fill(0, 200, 255, 150 + sin(frameCount * 0.2) * 50);
      ellipse(-this.width * 0.8, this.height / 10, 8, 8);
      ellipse(this.width * 0.8, this.height / 10, 8, 8);
      
      // Cockpit with glass reflection effect
      // Base cockpit
      fill(200, 230, 255, 200);
      ellipse(0, -this.height / 4, this.width / 3, this.height / 3);
      
      // Cockpit reflection
      fill(255, 255, 255, 100 + sin(frameCount * 0.1) * 50);
      arc(0, -this.height / 4, this.width / 3 * 0.8, this.height / 3 * 0.8, PI + PI/4, TWO_PI - PI/4);
      
      // Thrusters with animation
      // Main thruster
      fill(255, 165 + thrusterFlicker, 0, 200); // Orange with transparency
      beginShape();
      vertex(-this.width / 6, this.height / 4);
      vertex(this.width / 6, this.height / 4);
      vertex(0, this.height / 2 + thrusterFlicker);
      endShape(CLOSE);
      
      // Thruster glow
      fill(255, 200, 0, 100);
      ellipse(0, this.height / 3, this.width / 3 + thrusterFlicker, 10 + thrusterFlicker);
      
      // Side thrusters
      fill(255, 100 + thrusterFlicker, 0, 150); // Orange with transparency
      
      // Left thruster
      beginShape();
      vertex(-this.width / 3, this.height / 4);
      vertex(-this.width / 2, this.height / 4);
      vertex(-this.width / 2.5, this.height / 3 + thrusterFlicker);
      endShape(CLOSE);
      
      // Left thruster glow
      fill(255, 150, 0, 100);
      ellipse(-this.width / 2.5, this.height / 3, 10 + thrusterFlicker/2, 5 + thrusterFlicker/2);
      
      // Right thruster
      fill(255, 100 + thrusterFlicker, 0, 150);
      beginShape();
      vertex(this.width / 3, this.height / 4);
      vertex(this.width / 2, this.height / 4);
      vertex(this.width / 2.5, this.height / 3 + thrusterFlicker);
      endShape(CLOSE);
      
      // Right thruster glow
      fill(255, 150, 0, 100);
      ellipse(this.width / 2.5, this.height / 3, 10 + thrusterFlicker/2, 5 + thrusterFlicker/2);
      
      // Power level indicators
      if (this.powerLevel > 0) {
        // Power glow
        noFill();
        let powerColor = this.powerLevel === 1 ? 
                        color(255, 255, 0) : // Yellow for double shot
                        color(255, 150, 0);  // Orange for triple shot
        
        let powerPulse = sin(frameCount * 0.2) * 50;
        stroke(powerColor[0], powerColor[1], powerColor[2], 100 + powerPulse);
        strokeWeight(2);
        
        if (this.powerLevel === 1) {
          // Double shot indicator
          line(-this.width / 4, -this.height / 3, -this.width / 4, -this.height / 1.5);
          line(this.width / 4, -this.height / 3, this.width / 4, -this.height / 1.5);
          
          // Energy orbs at gun tips
          noStroke();
          fill(255, 255, 0, 150 + powerPulse);
          ellipse(-this.width / 4, -this.height / 1.5, 6, 6);
          ellipse(this.width / 4, -this.height / 1.5, 6, 6);
        } else if (this.powerLevel === 2) {
          // Triple shot indicator
          line(-this.width / 3, -this.height / 3, -this.width / 3, -this.height / 1.5);
          line(0, -this.height / 2, 0, -this.height * 0.8);
          line(this.width / 3, -this.height / 3, this.width / 3, -this.height / 1.5);
          
          // Energy orbs at gun tips
          noStroke();
          fill(255, 150, 0, 150 + powerPulse);
          ellipse(-this.width / 3, -this.height / 1.5, 6, 6);
          ellipse(0, -this.height * 0.8, 6, 6);
          ellipse(this.width / 3, -this.height / 1.5, 6, 6);
        }
        noStroke();
      }
      
      pop();
    }
  
    reset() {
      this.x = width / 2;
      this.y = height - 30;
      this.shooting = false;
      this.cooldown = 0;
      this.powerLevel = 0;
      this.powerupTimer = 0;
      this.thrusterAnimation = 0;
      this.shieldActive = false;
      this.shieldHealth = 0;
      this.invincible = false;
      this.invincibleTimer = 0;
      this.lastPowerupTime = 0;
      this.speed = 2; // Reset speed to initial value
      this.lives = 3; // Reset lives to initial value
    }
  }
  
  // Enemy Class
  class Enemy {
    constructor(x, y, level) {
      this.x = x;
      this.y = y;
      this.width = 30;
      this.height = 30;
      this.speed = random(1, 2);
      this.type = floor(random(3)); // 0, 1, or 2 for different enemy types
      
      // Base speed adjusted by level (increases by 0.2 per level)
      let levelSpeedBonus = (level - 1) * 0.2;
      
      // Different base speeds for different enemy types
      if (this.type === 0) {
        // Scout - fastest
        this.speed = random(1.5, 2.5) + levelSpeedBonus;
      } else if (this.type === 1) {
        // Destroyer - medium speed
        this.speed = random(1.2, 1.8) + levelSpeedBonus;
      } else {
        // Dreadnought - slowest but toughest
        this.speed = random(0.8, 1.2) + levelSpeedBonus;
      }
      
      this.health = this.type + 1; // Health based on enemy type
      this.pulseTime = 0;
    }
  
    update() {
      this.y += this.speed;
      this.pulseTime += 0.1;
    }
  
    draw() {
      push();
      translate(this.x, this.y);
      
      // Pulsing effect for shields
      let pulse = sin(this.pulseTime) * 5;
      
      if (this.type === 0) {
        // Scout ship - Fast but weak - Red theme
        
        // Engine glow
        fill(255, 100, 0, 150 + pulse);
        ellipse(0, this.height/3 + 5, this.width/2 + pulse, 10);
        
        // Main body
        fill(255, 0, 0); // Red base
        beginShape();
        vertex(-this.width/2, this.height/3);
        vertex(-this.width/4, -this.height/2);
        vertex(this.width/4, -this.height/2);
        vertex(this.width/2, this.height/3);
        endShape(CLOSE);
        
        // Body details
        fill(200, 0, 0);
        beginShape();
        vertex(-this.width/4, -this.height/2);
        vertex(0, -this.height/3);
        vertex(this.width/4, -this.height/2);
        endShape(CLOSE);
        
        // Cockpit
        fill(255, 50, 50, 150); // Red with transparency
        ellipse(0, -this.height/6, this.width/3, this.height/4);
        
        // Cockpit glow
        fill(255, 200, 200, 100 + pulse);
        ellipse(0, -this.height/6, this.width/5, this.height/6);
        
        // Wing details
        stroke(150, 0, 0);
        strokeWeight(1);
        line(-this.width/2, this.height/3, -this.width/4, -this.height/4);
        line(this.width/2, this.height/3, this.width/4, -this.height/4);
        noStroke();
        
      } else if (this.type === 1) {
        // Destroyer - Medium speed and strength - Purple theme
        
        // Engine glow
        fill(150, 0, 255, 100 + pulse);
        ellipse(-this.width/4, this.height/3 + 5, this.width/4, 8);
        ellipse(this.width/4, this.height/3 + 5, this.width/4, 8);
        
        // Main body
        fill(150, 0, 255); // Purple base
        beginShape();
        vertex(-this.width/2, this.height/3);
        vertex(-this.width/3, -this.height/3);
        vertex(0, -this.height/2);
        vertex(this.width/3, -this.height/3);
        vertex(this.width/2, this.height/3);
        endShape(CLOSE);
        
        // Wings with more detail
        fill(120, 0, 200);
        // Left wing
        beginShape();
        vertex(-this.width/2, this.height/3);
        vertex(-this.width/2 - 10, 0);
        vertex(-this.width/2 - 5, -this.height/5);
        vertex(-this.width/3, -this.height/3);
        vertex(-this.width/3, this.height/3);
        endShape(CLOSE);
        
        // Right wing
        beginShape();
        vertex(this.width/2, this.height/3);
        vertex(this.width/2 + 10, 0);
        vertex(this.width/2 + 5, -this.height/5);
        vertex(this.width/3, -this.height/3);
        vertex(this.width/3, this.height/3);
        endShape(CLOSE);
        
        // Cockpit
        fill(200, 200, 255); // Light purple
        ellipse(0, -this.height/6, this.width/4, this.height/5);
        
        // Cockpit glow
        fill(255, 255, 255, 100 + pulse);
        ellipse(0, -this.height/6, this.width/8, this.height/10);
        
        // Shield effect
        noFill();
        stroke(150, 0, 255, 100 + pulse);
        strokeWeight(2);
        arc(0, 0, this.width + 10, this.height + 10, PI, TWO_PI);
        
        // Shield energy details
        for (let i = 0; i < 5; i++) {
          let angle = map(i, 0, 4, PI + PI/8, TWO_PI - PI/8);
          let x1 = cos(angle) * (this.width/2 + 5);
          let y1 = sin(angle) * (this.height/2 + 5);
          let x2 = cos(angle) * (this.width/2 + 5 + sin(this.pulseTime + i) * 3);
          let y2 = sin(angle) * (this.height/2 + 5 + sin(this.pulseTime + i) * 3);
          stroke(200, 100, 255, 150);
          strokeWeight(1);
          line(x1, y1, x2, y2);
        }
        
        noStroke();
        
      } else if (this.type === 2) {
        // Dreadnought - Slow but powerful - Blue theme
        
        // Engine glow
        fill(0, 200, 255, 150 + pulse); // Cyan with pulsing transparency
        rect(-this.width/3, this.height/2, this.width/6, 5, 5);
        rect(0, this.height/2, this.width/6, 5, 5);
        rect(this.width/3 - this.width/6, this.height/2, this.width/6, 5, 5);
        
        // Main body
        fill(0, 0, 150); // Dark blue base
        rect(-this.width/2, -this.height/2, this.width, this.height, 5);
        
        // Body details
        fill(0, 50, 200);
        rect(-this.width/2 + 5, -this.height/2 + 5, this.width - 10, this.height/3, 3);
        
        // Top cannon
        fill(50, 50, 50);
        rect(-this.width/8, -this.height/2 - 10, this.width/4, 10, 2);
        
        // Cannon energy glow
        fill(0, 200, 255, 150 + pulse);
        ellipse(0, -this.height/2 - 5, 6, 6);
        
        // Side cannons with more detail
        fill(30, 30, 30);
        // Left cannon
        rect(-this.width/2 - 5, -this.height/4, 10, this.height/2, 2);
        // Right cannon
        rect(this.width/2 - 5, -this.height/4, 10, this.height/2, 2);
        
        // Cannon details
        fill(50, 50, 50);
        rect(-this.width/2 - 5, -this.height/4, 10, this.height/4, 2);
        rect(this.width/2 - 5, -this.height/4, 10, this.height/4, 2);
        
        // Cannon energy glow
        fill(0, 150, 255, 100 + pulse);
        ellipse(-this.width/2, -this.height/4 + this.height/8, 4, 8);
        ellipse(this.width/2, -this.height/4 + this.height/8, 4, 8);
        
        // Shield effect with more detail
        noFill();
        stroke(0, 100, 255, 80 + pulse);
        strokeWeight(3);
        ellipse(0, 0, this.width + 15, this.height + 15);
        
        // Shield energy ripples
        stroke(100, 200, 255, 50 + pulse/2);
        strokeWeight(1);
        ellipse(0, 0, this.width + 25, this.height + 25);
        
        // Shield energy nodes
        noStroke();
        fill(0, 150, 255, 100 + pulse);
        for (let i = 0; i < 4; i++) {
          let angle = i * PI/2;
          let x = cos(angle) * (this.width/2 + 7);
          let y = sin(angle) * (this.height/2 + 7);
          ellipse(x, y, 5, 5);
        }
      }
      
      pop();
    }
  }
  
  // Explosion Class
  class Explosion {
    constructor(x, y, size) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.lifetime = 30; // Increased lifetime for longer effect
      this.particles = [];
      this.shockwave = {
        size: 5,
        maxSize: size * 2,
        alpha: 200
      };
      
      // Create explosion particles with more variety
      for (let i = 0; i < 30; i++) { // More particles
        let speed = random(1, 5);
        let angle = random(TWO_PI);
        let particleSize = random(2, 10);
        
        // Create different colored particles for more visual interest
        let particleType = floor(random(3));
        let particleColor;
        
        if (particleType === 0) {
          // Bright center - white/yellow
          particleColor = color(255, random(200, 255), random(0, 150), 255);
        } else if (particleType === 1) {
          // Mid flame - orange
          particleColor = color(255, random(100, 200), 0, 255);
        } else {
          // Outer flame - red
          particleColor = color(255, random(0, 100), 0, 255);
        }
        
        this.particles.push({
          x: 0,
          y: 0,
          vx: cos(angle) * speed,
          vy: sin(angle) * speed,
          size: particleSize,
          color: particleColor,
          rotation: random(TWO_PI),
          rotationSpeed: random(-0.2, 0.2)
        });
      }
      
      // Add some slower smoke particles
      for (let i = 0; i < 10; i++) {
        let speed = random(0.5, 2);
        let angle = random(TWO_PI);
        let smokeSize = random(5, 15);
        
        this.particles.push({
          x: 0,
          y: 0,
          vx: cos(angle) * speed,
          vy: sin(angle) * speed - 0.5, // Slight upward drift
          size: smokeSize,
          color: color(100, 100, 100, 150),
          isSmoke: true,
          rotation: random(TWO_PI),
          rotationSpeed: random(-0.1, 0.1)
        });
      }
    }
  
    update() {
      this.lifetime--;
      
      // Update shockwave
      if (this.shockwave.size < this.shockwave.maxSize) {
        this.shockwave.size += (this.shockwave.maxSize - this.shockwave.size) * 0.2;
      }
      this.shockwave.alpha *= 0.9;
      
      // Update particles
      for (let p of this.particles) {
        p.x += p.vx;
        p.y += p.vy;
        
        // Add some gravity and wind effects
        p.vy += 0.05;
        p.vx *= 0.98;
        
        // Rotate particles
        p.rotation += p.rotationSpeed;
        
        if (p.isSmoke) {
          // Smoke particles get larger and fade
          p.size *= 1.01;
          p.color.setAlpha(p.color.levels[3] * 0.95);
        } else {
          // Fire particles shrink
          p.size *= 0.95;
          
          // Fade out based on lifetime
          let fadeStart = 15;
          if (this.lifetime < fadeStart) {
            let alpha = map(this.lifetime, 0, fadeStart, 0, p.color.levels[3]);
            p.color.setAlpha(alpha);
          }
        }
      }
    }
  
    draw() {
      push();
      translate(this.x, this.y);
      
      // Draw shockwave
      noFill();
      stroke(255, 200, 50, this.shockwave.alpha);
      strokeWeight(2);
      ellipse(0, 0, this.shockwave.size);
      
      // Draw bright flash at the beginning
      if (this.lifetime > 25) {
        let flashAlpha = map(this.lifetime, 25, 30, 0, 150);
        fill(255, 255, 200, flashAlpha);
        ellipse(0, 0, this.size);
      }
      
      // Draw particles
      for (let p of this.particles) {
        push();
        translate(p.x, p.y);
        rotate(p.rotation);
        
        fill(p.color);
        noStroke();
        
        if (p.isSmoke) {
          // Smoke particles are more cloud-like
          ellipse(0, 0, p.size, p.size * 0.8);
        } else {
          // Fire particles are more varied
          let particleType = floor(random(3));
          if (particleType === 0) {
            // Circle
            ellipse(0, 0, p.size);
          } else if (particleType === 1) {
            // Square
            rect(-p.size/2, -p.size/2, p.size, p.size);
          } else {
            // Triangle
            triangle(
              -p.size/2, p.size/2,
              0, -p.size/2,
              p.size/2, p.size/2
            );
          }
        }
        
        pop();
      }
      
      pop();
    }
  
    isDead() {
      return this.lifetime <= 0;
    }
  }
  
  // PowerUp Class
  class PowerUp {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.width = 20;
      this.height = 20;
      this.type = floor(random(3)); // 0: double shot, 1: triple shot, 2: shield
      this.speed = 2;
      this.rotation = 0;
    }
    
    update() {
      this.y += this.speed;
      this.rotation += 0.05;
    }
    
    draw() {
      push();
      translate(this.x, this.y);
      rotate(this.rotation);
      
      if (this.type === 0) {
        // Double shot powerup (yellow)
        // Outer glow
        fill(255, 255, 0, 50 + sin(frameCount * 0.1) * 30);
        ellipse(0, 0, this.width * 1.5, this.height * 1.5);
        
        // Base with gradient
        let gradient = drawingContext.createRadialGradient(0, 0, 0, 0, 0, this.width/2);
        gradient.addColorStop(0, 'rgba(255, 255, 150, 1)');
        gradient.addColorStop(0.7, 'rgba(255, 255, 0, 1)');
        gradient.addColorStop(1, 'rgba(200, 200, 0, 1)');
        drawingContext.fillStyle = gradient;
        ellipse(0, 0, this.width, this.height);
        
        // Energy particles
        for (let i = 0; i < 5; i++) {
          let angle = frameCount * 0.05 + i * TWO_PI / 5;
          let x = cos(angle) * (this.width/2 - 2);
          let y = sin(angle) * (this.height/2 - 2);
          fill(255, 255, 255, 150 + sin(frameCount * 0.2 + i) * 50);
          ellipse(x, y, 3, 3);
        }
        
        // Double gun icon
        fill(200, 200, 0);
        // Left gun
        rect(-7, -8, 4, 16, 1);
        // Right gun
        rect(3, -8, 4, 16, 1);
        // Connecting piece
        rect(-7, 0, 14, 3, 1);
        
        // Bullet indicators with glow
        fill(255);
        ellipse(-5, -10, 3, 3);
        ellipse(5, -10, 3, 3);
        
        // Bullet glow
        fill(255, 255, 200, 150);
        ellipse(-5, -10, 5, 5);
        ellipse(5, -10, 5, 5);
        
      } else if (this.type === 1) {
        // Triple shot powerup (orange)
        // Outer glow
        fill(255, 150, 0, 50 + sin(frameCount * 0.1) * 30);
        ellipse(0, 0, this.width * 1.5, this.height * 1.5);
        
        // Base with gradient
        let gradient = drawingContext.createRadialGradient(0, 0, 0, 0, 0, this.width/2);
        gradient.addColorStop(0, 'rgba(255, 200, 100, 1)');
        gradient.addColorStop(0.7, 'rgba(255, 150, 0, 1)');
        gradient.addColorStop(1, 'rgba(200, 100, 0, 1)');
        drawingContext.fillStyle = gradient;
        ellipse(0, 0, this.width, this.height);
        
        // Energy particles
        for (let i = 0; i < 5; i++) {
          let angle = frameCount * 0.05 + i * TWO_PI / 5;
          let x = cos(angle) * (this.width/2 - 2);
          let y = sin(angle) * (this.height/2 - 2);
          fill(255, 255, 200, 150 + sin(frameCount * 0.2 + i) * 50);
          ellipse(x, y, 3, 3);
        }
        
        // Triple gun icon
        fill(200, 100, 0);
        // Left gun
        rect(-8, -6, 4, 12, 1);
        // Middle gun
        rect(-2, -10, 4, 20, 1);
        // Right gun
        rect(4, -6, 4, 12, 1);
        // Connecting piece
        rect(-8, 2, 16, 3, 1);
        
        // Bullet indicators with glow
        fill(255);
        ellipse(-6, -8, 3, 3);
        ellipse(0, -12, 3, 3);
        ellipse(6, -8, 3, 3);
        
        // Bullet glow
        fill(255, 200, 150, 150);
        ellipse(-6, -8, 5, 5);
        ellipse(0, -12, 5, 5);
        ellipse(6, -8, 5, 5);
        
      } else if (this.type === 2) {
        // Shield powerup (blue)
        // Outer glow
        fill(0, 150, 255, 50 + sin(frameCount * 0.1) * 30);
        ellipse(0, 0, this.width * 1.5, this.height * 1.5);
        
        // Base with gradient
        let gradient = drawingContext.createRadialGradient(0, 0, 0, 0, 0, this.width/2);
        gradient.addColorStop(0, 'rgba(100, 200, 255, 1)');
        gradient.addColorStop(0.7, 'rgba(0, 150, 255, 1)');
        gradient.addColorStop(1, 'rgba(0, 100, 200, 1)');
        drawingContext.fillStyle = gradient;
        ellipse(0, 0, this.width, this.height);
        
        // Energy particles
        for (let i = 0; i < 5; i++) {
          let angle = frameCount * 0.05 + i * TWO_PI / 5;
          let x = cos(angle) * (this.width/2 - 2);
          let y = sin(angle) * (this.height/2 - 2);
          fill(200, 255, 255, 150 + sin(frameCount * 0.2 + i) * 50);
          ellipse(x, y, 3, 3);
        }
        
        // Shield icon
        noFill();
        stroke(255);
        strokeWeight(2);
        arc(0, 0, this.width - 6, this.height - 6, PI, TWO_PI);
        
        // Shield glow effect
        stroke(0, 200, 255, 150 + sin(frameCount * 0.2) * 50);
        strokeWeight(1);
        arc(0, 0, this.width - 2, this.height - 2, PI, TWO_PI);
        
        // Energy lines
        for (let i = 0; i < 3; i++) {
          let angle = map(i, 0, 2, PI + PI/6, TWO_PI - PI/6);
          stroke(200, 255, 255, 150);
          strokeWeight(1);
          line(0, 0, cos(angle) * (this.width/2 - 4), sin(angle) * (this.height/2 - 4));
        }
        
        // Ship silhouette inside shield
        noStroke();
        fill(255, 255, 255, 150);
        triangle(-3, 4, 3, 4, 0, -4);
      }
      
      pop();
    }
    
    isCollidingWithPlayer(player) {
      let d = dist(this.x, this.y, player.x, player.y);
      return d < (this.width / 2 + player.width / 3);
    }
  }
  
  // Bullet Class
  class Bullet {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.radius = 5;
      this.speed = 5;
      this.trailParticles = [];
      this.maxTrailParticles = 10;
      this.pulseOffset = random(TWO_PI); // Random offset for pulsing effect
    }
  
    update() {
      this.y -= this.speed;
      
      // Add trail particle
      this.trailParticles.push({
        x: this.x,
        y: this.y,
        radius: this.radius * 0.8,
        alpha: 200
      });
      
      // Limit trail length
      if (this.trailParticles.length > this.maxTrailParticles) {
        this.trailParticles.shift();
      }
      
      // Update trail particles
      for (let p of this.trailParticles) {
        p.radius *= 0.9;
        p.alpha *= 0.85;
      }
    }
  
    draw() {
      // Draw trail
      for (let i = 0; i < this.trailParticles.length; i++) {
        let p = this.trailParticles[i];
        let alpha = p.alpha;
        
        // Outer glow
        fill(200, 200, 255, alpha * 0.3);
        ellipse(p.x, p.y, p.radius * 2.5);
        
        // Inner trail
        fill(255, 255, 255, alpha);
        ellipse(p.x, p.y, p.radius);
      }
      
      // Pulsing effect for bullet
      let pulse = sin(frameCount * 0.2 + this.pulseOffset) * 2;
      
      // Outer glow
      fill(100, 150, 255, 100);
      ellipse(this.x, this.y, (this.radius + pulse) * 2.5);
      
      // Inner glow
      fill(150, 200, 255, 200);
      ellipse(this.x, this.y, (this.radius + pulse) * 1.5);
      
      // Core
      fill(255); // White
      ellipse(this.x, this.y, this.radius * 2);
    }
  }
  
  // Game Class
  class Game {
    constructor() {
      this.state = 'start';
      this.score = 0;
      this.lives = 3; // Keep this for initialization
      this.player = new Player();
      this.player.lives = this.lives; // Set player lives from game lives
      this.enemies = [];
      this.bullets = [];
      this.stars = [];
      this.explosions = [];
      this.powerups = [];
      this.spawnInterval = 60; // frames
      this.frameCount = 0;
      this.level = 1;
      this.enemiesKilled = 0;
      this.levelUpThreshold = 10;
      this.powerupChance = 0.2; // 20% chance to spawn a powerup when enemy is destroyed
      this.gameTitle = "COSMIC DEFENDER";
      this.shareMessage = "I scored {score} in COSMIC DEFENDER! Can you beat me? #CosmicDefender #AIGames";
      this.levelUpMessage = "";
      this.levelUpTimer = 0;
      this.lastEnemyKillTime = 0; // Track when the last enemy was killed
      
      // Leaderboard related properties
      this.leaderboardData = [];
      this.playerEmail = "";
      this.emailEntered = false;
      this.cursorPosition = 0;
      this.isSubmittingScore = false;
      this.submissionStatus = ""; // "success", "error", or ""
      this.showLeaderboard = false;
      this.emailEntered = false; // Track if email has been entered
      this.cursorPosition = 0; // Add cursor position tracking
      
      // Button hover tracking
      this.hoveredButton = null;
      
      this.initStars();
    }
  
    initStars() {
      for (let i = 0; i < 500; i++) {
        this.stars.push({
          x: random(width),
          y: random(height),
          size: random(1, 3),
          brightness: random(150, 255),
          twinkleSpeed: random(0.02, 0.05),
          twinkleOffset: random(0, TWO_PI),
          speed: map(random(1, 3), 1, 3, 0.2, 1.2) // Speed based on star size for parallax effect
        });
      }
    }
  
    update() {
      if (this.state === 'playing') {
        try {
          this.frameCount++;
          
          // Make sure player exists
          if (!this.player) {
            this.player = new Player();
          }
          
          // Sync lives between game and player
          this.lives = this.player.lives;
          
          // Update player with error handling
          try {
            this.player.update();
          } catch (error) {
            console.error("Error updating player:", error);
          }
          
          // Update game elements with error handling
          try {
            this.updateBullets();
          } catch (error) {
            console.error("Error updating bullets:", error);
          }
          
          try {
            this.updateEnemies();
          } catch (error) {
            console.error("Error updating enemies:", error);
          }
          
          try {
            this.updateExplosions();
          } catch (error) {
            console.error("Error updating explosions:", error);
          }
          
          try {
            this.updatePowerups();
          } catch (error) {
            console.error("Error updating powerups:", error);
          }
          
          try {
            this.checkCollisions();
          } catch (error) {
            console.error("Error in checkCollisions:", error);
          }
          
          // Update level up message timer with animation
          if (this.levelUpTimer > 0) {
            this.levelUpTimer--;
          }
          
          // Spawn enemies based on level
          try {
            if (this.frameCount % Math.max(10, this.spawnInterval - (this.level * 5)) === 0) {
              this.spawnEnemy();
            }
          } catch (error) {
            console.error("Error spawning enemy:", error);
          }
          
          // Check for level up with visual feedback
          if (this.enemiesKilled >= this.levelUpThreshold) {
            this.level++;
            this.enemiesKilled = 0;
            this.levelUpThreshold += 5;
            
            // Show level up message
            this.levelUpMessage = `LEVEL ${this.level}!`;
            this.levelUpTimer = 120; // Show for 2 seconds
            this.player.increaseSpeed();
          }
        } catch (error) {
          console.error("Critical error in game update:", error);
          // Just log the error but don't change game state
          // This prevents the game from ending prematurely
        }
      }
    }
  
    draw() {
      // Draw stars in the background (always visible)
      this.drawStars();
      
      // Draw based on game state
      if (this.state === 'start') {
        this.drawStartScreen();
      } else if (this.state === 'playing') {
        // Draw game elements
        this.player.draw();
        this.drawBullets();
        this.drawEnemies();
        this.drawPowerups();
        this.drawExplosions();
        this.drawUI();
      } else if (this.state === 'gameOver') {
        this.drawGameOver();
      } else if (this.state === 'leaderboard') {
        this.drawLeaderboard();
      }
    }
  
    spawnEnemy() {
      let x = random(40, width - 40);
      this.enemies.push(new Enemy(x, -30, this.level));
    }
  
    updateBullets() {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        this.bullets[i].update();
        if (this.bullets[i].y < 0) {
          this.bullets.splice(i, 1);
        }
      }
    }
  
    updateEnemies() {
      try {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          // Skip if enemy no longer exists
          if (!this.enemies[i]) continue;
          
          this.enemies[i].update();
          if (this.enemies[i].y > height) {
            this.enemies.splice(i, 1);
          } else if (this.player && this.isCollidingWithPlayer(this.enemies[i])) {
            console.log("Collision with enemy detected");
            
            if (this.player.hitByEnemy()) {
              this.lives--;
              console.log(`Player hit! Lives remaining: ${this.lives}`);
              
              if (this.lives <= 0) {
                console.log("Game over! Player has no lives left.");
                this.state = 'gameOver';
                this.player.lives = 0; // Ensure player lives is set to 0
                this.lives = 0; // Ensure game lives is also set to 0
              }
            } else {
              console.log("Player protected by shield or invincibility");
            }
            
            this.enemies.splice(i, 1);
          }
        }
      } catch (error) {
        console.error("Error in updateEnemies:", error);
        // Log the error but don't reset the game
      }
    }
  
    updateExplosions() {
      for (let i = this.explosions.length - 1; i >= 0; i--) {
        this.explosions[i].update();
        if (this.explosions[i].isDead()) {
          this.explosions.splice(i, 1);
        }
      }
    }
  
    updatePowerups() {
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        this.powerups[i].update();
        
        // Check if powerup is off screen
        if (this.powerups[i].y > height) {
          this.powerups.splice(i, 1);
          continue;
        }
        
        // Check if player collected powerup
        if (this.powerups[i].isCollidingWithPlayer(this.player)) {
          if (this.powerups[i].type === 0) {
            // Double shot
            this.player.activatePowerup(1);
          } else if (this.powerups[i].type === 1) {
            // Triple shot
            this.player.activatePowerup(2);
          } else if (this.powerups[i].type === 2) {
            // Shield
            this.player.activateShield();
          }
          
          this.powerups.splice(i, 1);
        }
      }
    }
  
    drawPowerups() {
      for (let powerup of this.powerups) {
        powerup.draw();
      }
    }
  
    checkCollisions() {
      try {
        // Check bullet-enemy collisions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            if (this.isColliding(this.bullets[i], this.enemies[j])) {
              // Bullet hit enemy
              this.enemies[j].health--;
              
              // Remove bullet
              this.bullets.splice(i, 1);
              
              // Check if enemy is destroyed
              if (this.enemies[j].health <= 0) {
                // Create explosion
                this.explosions.push(new Explosion(this.enemies[j].x, this.enemies[j].y, 1));
                
                // Add score
                this.score += 10 * this.level;
                
                // Track enemy kill
                this.enemiesKilled++;
                this.lastEnemyKillTime = millis();
                
                // Chance to spawn powerup
                if (random() < this.powerupChance) {
                  this.powerups.push(new PowerUp(this.enemies[j].x, this.enemies[j].y));
                }
                
                // Remove enemy
                this.enemies.splice(j, 1);
                
                // Check for level up
                if (this.enemiesKilled >= this.levelUpThreshold) {
                  this.level++;
                  this.enemiesKilled = 0;
                  this.levelUpMessage = `LEVEL ${this.level}!`;
                  this.levelUpTimer = 120; // Show for 2 seconds
                  this.player.increaseSpeed();
                }
              }
              
              break; // Bullet can only hit one enemy
            }
          }
        }
        
        // Check player-enemy collisions
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          if (this.isCollidingWithPlayer(this.enemies[i])) {
            console.log("Player collided with enemy");
            
            // Create explosion
            this.explosions.push(new Explosion(this.enemies[i].x, this.enemies[i].y, 1.5));
            
            // Remove enemy
            this.enemies.splice(i, 1);
            
            // Player takes damage
            let playerDied = this.player.hitByEnemy();
            console.log("Collision with enemy detected");
            
            // Update game lives to match player lives
            this.lives = this.player.lives;
            
            // Check if game over
            if (playerDied || this.player.lives <= 0) {
              console.log("Game over! Player has no lives left.");
              this.state = 'gameOver';
              this.player.lives = 0; // Ensure player lives is set to 0
              this.lives = 0; // Ensure game lives is also set to 0
            }
          }
        }
      } catch (error) {
        console.error("Error in checkCollisions:", error);
      }
    }
  
    isColliding(bullet, enemy) {
      let d = dist(bullet.x, bullet.y, enemy.x, enemy.y);
      return d < bullet.radius + enemy.width / 2;
    }
  
    isCollidingWithPlayer(enemy) {
      try {
        if (!this.player || !enemy) return false;
        
        let playerLeft = this.player.x - this.player.width / 2;
        let playerRight = this.player.x + this.player.width / 2;
        let playerTop = this.player.y - this.player.height;
        let playerBottom = this.player.y;
        let enemyLeft = enemy.x - enemy.width / 2;
        let enemyRight = enemy.x + enemy.width / 2;
        let enemyTop = enemy.y - enemy.height / 2;
        let enemyBottom = enemy.y + enemy.height / 2;
        return (
          playerLeft < enemyRight &&
          playerRight > enemyLeft &&
          playerTop < enemyBottom &&
          playerBottom > enemyTop
        );
      } catch (error) {
        console.error("Error in isCollidingWithPlayer:", error);
        return false; // Assume no collision on error
      }
    }
  
    drawStars() {
      // Update and draw stars with twinkling and parallax movement
      for (let i = 0; i < this.stars.length; i++) {
        let star = this.stars[i];
        
        // Move stars downward to create the illusion of forward movement
        star.y += star.speed;
        
        // Reset stars that go off screen
        if (star.y > height) {
          star.y = 0;
          star.x = random(width);
        }
        
        // Twinkling effect
        let twinkle = sin(frameCount * star.twinkleSpeed + star.twinkleOffset);
        let brightness = star.brightness + twinkle * 40;
        
        // Draw the star
        fill(brightness);
        noStroke();
        
        // Larger stars get a subtle glow effect
        if (star.size > 2) {
          // Outer glow
          fill(brightness, 100);
          ellipse(star.x, star.y, star.size * 2);
          // Inner bright core
          fill(brightness);
        }
        
        ellipse(star.x, star.y, star.size);
      }
    }
  
    drawBullets() {
      for (let bullet of this.bullets) {
        bullet.draw();
      }
    }
  
    drawEnemies() {
      for (let enemy of this.enemies) {
        enemy.draw();
      }
    }
  
    drawExplosions() {
      for (let explosion of this.explosions) {
        explosion.draw();
      }
    }
  
    drawUI() {
      push();
      textFont('Orbitron');
      
      // Draw game border/frame
      noFill();
      strokeWeight(2);
      let borderGradient = drawingContext.createLinearGradient(0, 0, width, height);
      borderGradient.addColorStop(0, '#00aaff');
      borderGradient.addColorStop(0.5, '#0066cc');
      borderGradient.addColorStop(1, '#00aaff');
      drawingContext.strokeStyle = borderGradient;
      
      // Add glow to the border
      drawingContext.shadowBlur = 10;
      drawingContext.shadowColor = 'rgba(0, 150, 255, 0.7)';
      rect(0, 0, width, height);
      drawingContext.shadowBlur = 0;
      
      // UI padding from edges
      const padding = 20;
      
      // Score with retro styling
      textAlign(LEFT);
      textSize(22);
      
      // Score shadow/glow
      fill(0, 200, 255, 50);
      text("SCORE: " + this.score, padding, 35);
      
      // Score with gradient
      drawingContext.save();
      let scoreGradient = drawingContext.createLinearGradient(padding, 15, padding, 35);
      scoreGradient.addColorStop(0, '#00ffff');
      scoreGradient.addColorStop(1, '#0088ff');
      
      drawingContext.fillStyle = scoreGradient;
      text("SCORE: " + this.score, padding, 32);
      drawingContext.restore();
      
      // Lives display with heart icons - ENHANCED VERSION
      let heartSize = 20; // Decreased heart size from 30 to 20
      let heartSpacing = 30; // Decreased spacing from 40 to 30
      let heartsStartX = width - padding - (2 * heartSpacing); // Always position for 3 hearts max
      let heartsY = 30;
      
      // Draw "LIVES:" text with gradient
      drawingContext.save();
      let livesGradient = drawingContext.createLinearGradient(heartsStartX - 60, heartsY - 10, heartsStartX - 10, heartsY + 10);
      livesGradient.addColorStop(0, '#ff5555');
      livesGradient.addColorStop(1, '#ff0000');
      drawingContext.fillStyle = livesGradient;
      
      textAlign(RIGHT);
      textSize(16);
      
      // Add glow to LIVES text
      drawingContext.shadowBlur = 6;
      drawingContext.shadowColor = 'rgba(255, 0, 0, 0.7)';
      text("LIVES:", heartsStartX - 15, heartsY + 5);
      drawingContext.shadowBlur = 0;
      drawingContext.restore();
      
      // Ensure player lives is capped at 3
      let displayLives = min(this.player.lives, 3);
      
      // Make sure lives is not negative
      displayLives = max(displayLives, 0);
      
      // Ensure game and player lives are in sync
      this.lives = this.player.lives = min(max(this.player.lives, 0), 3);
      
      // Draw hearts
      for (let i = 0; i < displayLives; i++) {
        this.drawHeart(heartsStartX + (i * heartSpacing), heartsY, heartSize);
      }
      
      // Level indicator with retro styling
      textAlign(CENTER);
      
      // Level text with glow
      for (let i = 3; i > 0; i--) {
        let alpha = map(i, 3, 0, 20, 80);
        fill(255, 200, 0, alpha);
        text("LEVEL " + this.level, width / 2, 35 + i);
      }
      
      // Level text with gradient
      drawingContext.save();
      let levelGradient = drawingContext.createLinearGradient(width/2 - 50, 15, width/2 + 50, 35);
      levelGradient.addColorStop(0, '#ffff00');
      levelGradient.addColorStop(1, '#ff8800');
      
      drawingContext.fillStyle = levelGradient;
      text("LEVEL " + this.level, width / 2, 35);
      drawingContext.restore();
      
      // Level progress bar - positioned below level text
      let progressBarWidth = 200;
      let progressBarHeight = 10;
      let progressBarX = width / 2 - progressBarWidth / 2;
      let progressBarY = 55; // Positioned below level text
      let progress = this.enemiesKilled / this.levelUpThreshold;
      
      // Progress bar background with glow
      drawingContext.save();
      drawingContext.shadowBlur = 10;
      drawingContext.shadowColor = 'rgba(0, 100, 255, 0.5)';
      fill(20, 40, 80);
      rect(progressBarX, progressBarY, progressBarWidth, progressBarHeight, 5);
      drawingContext.restore();
      
      // Progress bar fill with gradient
      if (progress > 0) {
        drawingContext.save();
        let fillWidth = progressBarWidth * progress;
        let progressGradient = drawingContext.createLinearGradient(
          progressBarX, progressBarY, 
          progressBarX + progressBarWidth, progressBarY
        );
        progressGradient.addColorStop(0, '#00ffff');
        progressGradient.addColorStop(1, '#0088ff');
        
        drawingContext.fillStyle = progressGradient;
        drawingContext.beginPath();
        drawingContext.roundRect(
          progressBarX, 
          progressBarY, 
          fillWidth, 
          progressBarHeight, 
          5
        );
        drawingContext.fill();
        
        // Add pulsing effect when close to level up
        if (progress > 0.8) {
          let pulseAlpha = 100 + sin(frameCount * 0.2) * 50;
          drawingContext.shadowBlur = 15;
          drawingContext.shadowColor = `rgba(0, 255, 255, ${pulseAlpha / 255})`;
          drawingContext.fill();
        }
        drawingContext.restore();
      }
      
      // Powerup timer display - moved to left side below score
      if (this.player.powerLevel > 0 && this.player.powerupTimer > 0) {
        let powerupBarWidth = 150;
        let powerupBarHeight = 8;
        let powerupBarX = padding; // Left aligned
        let powerupBarY = 80; // Increased gap from score (was 55)
        let powerupProgress = this.player.powerupTimer / this.player.powerupDuration;
        
        // Powerup type indicator
        let powerupText = this.player.powerLevel === 1 ? "DOUBLE SHOT" : "TRIPLE SHOT";
        let powerupColor = this.player.powerLevel === 1 ? 
                          color(255, 255, 0) : // Yellow for double shot
                          color(255, 150, 0);  // Orange for triple shot
        
        // Powerup text with glow
        textAlign(LEFT); // Left aligned text
        textSize(16);
        
        // Text glow
        drawingContext.save();
        drawingContext.shadowBlur = 10;
        drawingContext.shadowColor = `rgba(${powerupColor.levels[0]}, ${powerupColor.levels[1]}, ${powerupColor.levels[2]}, 0.7)`;
        fill(powerupColor);
        
        // Flash when powerup is about to expire
        if (this.player.powerupTimer < 60 && frameCount % 10 < 5) {
          fill(255);
        }
        
        // Increased vertical spacing between text and bar
        text(powerupText, powerupBarX, powerupBarY - 10);
        drawingContext.restore();
        
        // Powerup bar background
        fill(20, 20, 20, 150);
        rect(powerupBarX, powerupBarY, powerupBarWidth, powerupBarHeight, 4);
        
        // Powerup bar fill with gradient
        if (powerupProgress > 0) {
          drawingContext.save();
          let fillWidth = powerupBarWidth * powerupProgress;
          
          let barGradient = drawingContext.createLinearGradient(
            powerupBarX, powerupBarY, 
            powerupBarX + powerupBarWidth, powerupBarY
          );
          
          if (this.player.powerLevel === 1) {
            barGradient.addColorStop(0, '#ffff00');
            barGradient.addColorStop(1, '#ffcc00');
          } else {
            barGradient.addColorStop(0, '#ff9900');
            barGradient.addColorStop(1, '#ff6600');
          }
          
          drawingContext.fillStyle = barGradient;
          rect(powerupBarX, powerupBarY, fillWidth, powerupBarHeight, 4);
          drawingContext.restore();
        }
      }
      
      // Show level up message with animation if timer is active
      if (this.levelUpTimer > 0) {
        textAlign(CENTER);
        textSize(36);
        
        // Calculate animation values
        let alpha = map(this.levelUpTimer, 0, 120, 0, 255);
        let scale = map(this.levelUpTimer, 0, 120, 1.5, 1);
        let y = height / 2 - 50;
        
        // Apply scale animation
        push();
        translate(width / 2, y);
        scale(scale);
        
        // Draw text with glow
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'rgba(255, 200, 0, 0.7)';
        fill(255, 255, 0, alpha);
        text(this.levelUpMessage, 0, 0);
        
        // Add speed increase message
        textSize(24);
        fill(0, 255, 255, alpha);
        text("SPEED INCREASED!", 0, 40);
        drawingContext.shadowBlur = 0;
        
        pop();
      }
      
      pop();
    }
    
    // Helper method to draw pixel-style heart
    drawHeart(x, y, size) {
      push();
      translate(x, y);
      
      // Pixel heart uses a grid-based approach
      let pixelSize = size / 8; // Divide the heart into an 8x8 grid
      noStroke();
      
      // Create a pixel heart pattern
      // 0 = empty, 1 = light red, 2 = dark red
      let heartPattern = [
        [0, 0, 0, 0, 0, 0, 0, 0],
        [0, 2, 2, 0, 0, 2, 2, 0],
        [2, 2, 2, 2, 2, 2, 2, 2],
        [2, 2, 2, 2, 2, 2, 2, 2],
        [2, 2, 2, 2, 2, 2, 2, 2],
        [0, 2, 2, 2, 2, 2, 2, 0],
        [0, 0, 2, 2, 2, 2, 0, 0],
        [0, 0, 0, 2, 2, 0, 0, 0]
      ];
      
      // Draw the pixel heart
      for (let row = 0; row < heartPattern.length; row++) {
        for (let col = 0; col < heartPattern[row].length; col++) {
          if (heartPattern[row][col] === 0) continue; // Skip empty pixels
          
          // Calculate position
          let pixelX = (col - heartPattern[0].length/2) * pixelSize;
          let pixelY = (row - heartPattern.length/2) * pixelSize;
          
          // Choose color based on pattern value
          if (heartPattern[row][col] === 2) {
            fill(220, 0, 0); // Dark red
          } else {
            fill(255, 50, 50); // Light red
          }
          
          // Draw the pixel
          rect(pixelX, pixelY, pixelSize, pixelSize);
        }
      }
      
      // Add glow effect
      drawingContext.shadowBlur = 8;
      drawingContext.shadowColor = 'rgba(255, 0, 0, 0.7)';
      
      // Draw outline to create glow
      noFill();
      stroke(255, 0, 0, 150);
      strokeWeight(1);
      beginShape();
      for (let row = 0; row < heartPattern.length; row++) {
        for (let col = 0; col < heartPattern[row].length; col++) {
          if (heartPattern[row][col] === 0) continue;
          
          // Only draw outline for pixels at the edge
          let isEdge = false;
          
          // Check if this pixel has an empty neighbor
          if (row === 0 || col === 0 || row === heartPattern.length-1 || col === heartPattern[0].length-1) {
            isEdge = true;
          } else if (heartPattern[row-1][col] === 0 || heartPattern[row+1][col] === 0 || 
                    heartPattern[row][col-1] === 0 || heartPattern[row][col+1] === 0) {
            isEdge = true;
          }
          
          if (isEdge) {
            let pixelX = (col - heartPattern[0].length/2) * pixelSize;
            let pixelY = (row - heartPattern.length/2) * pixelSize;
            vertex(pixelX, pixelY);
            vertex(pixelX + pixelSize, pixelY);
            vertex(pixelX + pixelSize, pixelY + pixelSize);
            vertex(pixelX, pixelY + pixelSize);
            vertex(pixelX, pixelY);
          }
        }
      }
      endShape();
      
      drawingContext.shadowBlur = 0;
      pop();
    }
    
    drawStartScreen() {
      // Draw stars in the background
      this.drawStars();
      
      // Draw the title with retro styling
      push();
      textFont('Orbitron');
      textAlign(CENTER);
      
      // COSMIC DEFENDER title with 90s style
      let titleX = width / 2;
      let titleY = height * 0.3;
      let titleSize = 60;
      
      // Outer glow
      for (let i = 10; i > 0; i--) {
        let alpha = map(i, 10, 0, 20, 100);
        fill(0, 150, 255, alpha);
        textSize(titleSize + i);
        text("COSMIC DEFENDER", titleX, titleY);
      }
      
      // Gradient fill for main text
      drawingContext.save();
      let gradient = drawingContext.createLinearGradient(0, titleY - 30, 0, titleY + 30);
      gradient.addColorStop(0, '#00ffff');
      gradient.addColorStop(0.5, '#0088ff');
      gradient.addColorStop(1, '#0044ff');
      
      drawingContext.fillStyle = gradient;
      textSize(titleSize);
      text("COSMIC DEFENDER", titleX, titleY);
      
      // Add outline
      noFill();
      strokeWeight(3);
      stroke(255);
      text("COSMIC DEFENDER", titleX, titleY);
      drawingContext.restore();
      
      // If email not entered yet, show email input and instruction text
      if (!this.emailEntered) {
        // Email instruction text
        textSize(24);
        fill(255);
        text("Enter your email to play:", width / 2, height * 0.45);
        
        // Email input field - modern space-themed design
        let inputX = width / 2 - 150;
        let inputY = height / 2;
        let inputWidth = 300;
        let inputHeight = 50;
        
        // Create a space-themed gradient background for the input field
        let inputGradient = drawingContext.createLinearGradient(
          inputX, inputY, 
          inputX, inputY + inputHeight
        );
        inputGradient.addColorStop(0, 'rgba(10, 20, 40, 0.8)');
        inputGradient.addColorStop(1, 'rgba(20, 40, 80, 0.8)');
        drawingContext.fillStyle = inputGradient;
        
        // Draw input field background with rounded corners
        rect(inputX, inputY, inputWidth, inputHeight, 10);
        
        // Add a glowing border
        noFill();
        drawingContext.shadowBlur = 10;
        drawingContext.shadowColor = 'rgba(0, 150, 255, 0.5)';
        stroke(0, 150, 255);
        strokeWeight(2);
        rect(inputX, inputY, inputWidth, inputHeight, 10);
        drawingContext.shadowBlur = 0;
        noStroke();
        
        // Add email icon
        fill(0, 150, 255);
        textSize(20);
        textAlign(LEFT);
        text("✉", inputX + 15, inputY + 32);
        
        // Email input text with proper spacing after icon
        fill(255);
        textSize(20);
        
        // If no email entered yet, show placeholder text
        if (this.playerEmail.length === 0) {
          fill(150);
          text("your-email@example.com", inputX + 40, inputY + 32);
        } else {
          fill(255);
          text(this.playerEmail, inputX + 40, inputY + 32);
        }
        
        // Blinking cursor with improved animation
        if (frameCount % 30 < 15) {
          let cursorX = inputX + 40 + textWidth(this.playerEmail.substring(0, this.cursorPosition));
          stroke(0, 200, 255);
          strokeWeight(2);
          line(cursorX, inputY + 12, cursorX, inputY + 38);
          noStroke();
        }
        
        // Add small stars animation inside the input field for space theme
        for (let i = 0; i < 5; i++) {
          let starX = inputX + 20 + (i * 60);
          let starY = inputY + 25 + sin(frameCount * 0.05 + i) * 5;
          let starSize = 1 + sin(frameCount * 0.1 + i * 0.5) * 0.5;
          
          // Only show stars if no text is covering them
          if (textWidth(this.playerEmail) < starX - inputX - 40) {
            fill(255, 255, 255, 100);
            ellipse(starX, starY, starSize, starSize);
          }
        }
        
        // Add validation indicator
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.playerEmail.length > 0) {
          if (emailRegex.test(this.playerEmail)) {
            // Valid email indicator
            fill(0, 255, 100);
            ellipse(inputX + inputWidth - 20, inputY + inputHeight/2, 10, 10);
          } else {
            // Invalid email indicator
            fill(255, 100, 100);
            ellipse(inputX + inputWidth - 20, inputY + inputHeight/2, 10, 10);
          }
        }
        
        // Submit button with retro styling
        let submitBtnX = width / 2 - 100;
        let submitBtnY = height / 2 + 70;
        let submitBtnWidth = 200;
        let submitBtnHeight = 50;
        
        // Check if mouse is hovering over button
        let isHovering = 
            mouseX >= submitBtnX && 
            mouseX <= submitBtnX + submitBtnWidth &&
            mouseY >= submitBtnY && 
            mouseY <= submitBtnY + submitBtnHeight;
        
        // Button gradient with hover effect and retro styling
        drawingContext.save();
        let submitGradient = drawingContext.createLinearGradient(
          submitBtnX, submitBtnY, 
          submitBtnX, submitBtnY + submitBtnHeight
        );
        
        if (isHovering) {
          // Brighter gradient when hovering
          submitGradient.addColorStop(0, '#00aaff');
          submitGradient.addColorStop(1, '#0044ff');
          
          // Add glow effect on hover
          drawingContext.shadowBlur = 15;
          drawingContext.shadowColor = 'rgba(0, 150, 255, 0.7)';
        } else {
          // Normal gradient
          submitGradient.addColorStop(0, '#0088ff');
          submitGradient.addColorStop(1, '#0022aa');
        }
        
        drawingContext.fillStyle = submitGradient;
        
        // Button with rounded corners
        drawingContext.beginPath();
        drawingContext.roundRect(
          submitBtnX, 
          submitBtnY, 
          submitBtnWidth, 
          submitBtnHeight, 
          10
        );
        drawingContext.fill();
        drawingContext.restore();
        
        // Button text with retro style
        fill(255);
        textSize(24);
        textAlign(CENTER, CENTER);
        text("Continue", width / 2, submitBtnY + submitBtnHeight / 2);
        
        // Store button bounds for click detection
        this.submitEmailButtonBounds = {
          x: submitBtnX,
          y: submitBtnY,
          width: submitBtnWidth,
          height: submitBtnHeight
        };
        
        // Add click to input field functionality
        this.emailInputBounds = {
          x: inputX,
          y: inputY,
          width: inputWidth,
          height: inputHeight
        };
      } else {
        // Show game instructions with retro styling
        fill(255);
        textSize(24);
        textAlign(CENTER);
        text("Welcome, " + this.playerEmail.split('@')[0], width / 2, height / 2 - 40);
        
        textSize(20);
        text("Use arrow keys to move", width / 2, height / 2);
        text("Space to shoot", width / 2, height / 2 + 30);
        text("Collect powerups to upgrade your ship", width / 2, height / 2 + 60);
        
        // Start game button with retro styling
        let startBtnX = width / 2 - 100;
        let startBtnY = height / 2 + 120;
        let startBtnWidth = 200;
        let startBtnHeight = 50;
        
        // Check if mouse is hovering over button
        let isHovering = 
            mouseX >= startBtnX && 
            mouseX <= startBtnX + startBtnWidth &&
            mouseY >= startBtnY && 
            mouseY <= startBtnY + startBtnHeight;
        
        // Button gradient with hover effect and retro styling
        drawingContext.save();
        let startGradient = drawingContext.createLinearGradient(
          startBtnX, startBtnY, 
          startBtnX, startBtnY + startBtnHeight
        );
        
        if (isHovering) {
          // Brighter gradient when hovering
          startGradient.addColorStop(0, '#00ff80');
          startGradient.addColorStop(1, '#00aa40');
          
          // Add glow effect on hover
          drawingContext.shadowBlur = 15;
          drawingContext.shadowColor = 'rgba(0, 200, 100, 0.7)';
        } else {
          // Normal gradient
          startGradient.addColorStop(0, '#00cc60');
          startGradient.addColorStop(1, '#008830');
        }
        
        drawingContext.fillStyle = startGradient;
        
        // Button with rounded corners
        drawingContext.beginPath();
        drawingContext.roundRect(
          startBtnX, 
          startBtnY, 
          startBtnWidth, 
          startBtnHeight, 
          10
        );
        drawingContext.fill();
        drawingContext.restore();
        
        // Button text with retro style
        fill(255);
        textSize(24);
        textAlign(CENTER, CENTER);
        text("START GAME", width / 2, startBtnY + startBtnHeight / 2);
        
        // Store button bounds for click detection
        this.startButtonBounds = {
          x: startBtnX,
          y: startBtnY,
          width: startBtnWidth,
          height: startBtnHeight
        };
        
        // Leaderboard button with retro styling
        let leaderboardBtnX = width / 2 - 150;
        let leaderboardBtnY = height / 2 + 190;
        let leaderboardBtnWidth = 300;
        let leaderboardBtnHeight = 50;
        
        // Check if mouse is hovering over button
        let isLeaderboardHovering = 
            mouseX >= leaderboardBtnX && 
            mouseX <= leaderboardBtnX + leaderboardBtnWidth &&
            mouseY >= leaderboardBtnY && 
            mouseY <= leaderboardBtnY + leaderboardBtnHeight;
        
        // Button gradient with hover effect and retro styling
        drawingContext.save();
        let leaderboardGradient = drawingContext.createLinearGradient(
          leaderboardBtnX, leaderboardBtnY, 
          leaderboardBtnX, leaderboardBtnY + leaderboardBtnHeight
        );
        
        if (isLeaderboardHovering) {
          // Brighter gradient when hovering
          leaderboardGradient.addColorStop(0, '#00aaff');
          leaderboardGradient.addColorStop(1, '#0066cc');
          
          // Add glow effect on hover
          drawingContext.shadowBlur = 15;
          drawingContext.shadowColor = 'rgba(0, 150, 255, 0.7)';
        } else {
          // Normal gradient
          leaderboardGradient.addColorStop(0, '#0088cc');
          leaderboardGradient.addColorStop(1, '#004488');
        }
        
        drawingContext.fillStyle = leaderboardGradient;
        
        // Button with rounded corners
        drawingContext.beginPath();
        drawingContext.roundRect(
          leaderboardBtnX, 
          leaderboardBtnY, 
          leaderboardBtnWidth, 
          leaderboardBtnHeight, 
          10
        );
        drawingContext.fill();
        drawingContext.restore();
        
        // Button text with retro style
        fill(255);
        textSize(20);
        textAlign(CENTER, CENTER);
        text("VIEW LEADERBOARD", width / 2, leaderboardBtnY + leaderboardBtnHeight / 2);
        
        // Store button bounds for click detection
        this.startLeaderboardButtonBounds = {
          x: leaderboardBtnX,
          y: leaderboardBtnY,
          width: leaderboardBtnWidth,
          height: leaderboardBtnHeight
        };
      }
      pop();
    }
    
    drawGameOver() {
      // Draw stars in the background
      this.drawStars();
      
      push();
      textFont('Orbitron');
        textAlign(CENTER);
      
      // Game Over text with retro styling
      let gameOverX = width / 2;
      let gameOverY = height * 0.25;
      
      // Outer glow
      for (let i = 8; i > 0; i--) {
        let alpha = map(i, 8, 0, 20, 80);
        fill(255, 50, 50, alpha);
        textSize(60 + i);
        text("GAME OVER", gameOverX, gameOverY);
      }
      
      // Gradient fill for main text
      drawingContext.save();
      let gradient = drawingContext.createLinearGradient(0, gameOverY - 30, 0, gameOverY + 30);
      gradient.addColorStop(0, '#ff5555');
      gradient.addColorStop(0.5, '#ff0000');
      gradient.addColorStop(1, '#aa0000');
      
      drawingContext.fillStyle = gradient;
      textSize(60);
      text("GAME OVER", gameOverX, gameOverY);
      
      // Add outline
      noFill();
      strokeWeight(3);
      stroke(255);
      text("GAME OVER", gameOverX, gameOverY);
      drawingContext.restore();
      
      // Score display with retro styling
      textSize(32);
      fill(255, 255, 100);
      text("FINAL SCORE: " + this.score, width / 2, height * 0.35);
      
      // Player email display
      fill(255);
      textSize(20);
      text("Player: " + this.playerEmail.split('@')[0], width / 2, height * 0.42);
      
      // Submit to leaderboard button with retro styling
      let submitBtnX = width / 2 - 150;
      let submitBtnY = height / 2 + 20;
      let submitBtnWidth = 300;
      let submitBtnHeight = 50;
      
      // Check if mouse is hovering over button
      let isSubmitHovering = 
          mouseX >= submitBtnX && 
          mouseX <= submitBtnX + submitBtnWidth &&
          mouseY >= submitBtnY && 
          mouseY <= submitBtnY + submitBtnHeight;
      
      // Button gradient with hover effect and retro styling
      drawingContext.save();
      let submitGradient = drawingContext.createLinearGradient(
        submitBtnX, submitBtnY, 
        submitBtnX, submitBtnY + submitBtnHeight
      );
      
      if (isSubmitHovering) {
        // Brighter gradient when hovering
        submitGradient.addColorStop(0, '#00ff80');
        submitGradient.addColorStop(1, '#00aa40');
        
        // Add glow effect on hover
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'rgba(0, 200, 100, 0.7)';
      } else {
        // Normal gradient
        submitGradient.addColorStop(0, '#00cc60');
        submitGradient.addColorStop(1, '#008830');
      }
      
      drawingContext.fillStyle = submitGradient;
        
        // Button with rounded corners
      drawingContext.beginPath();
      drawingContext.roundRect(
        submitBtnX, 
        submitBtnY, 
        submitBtnWidth, 
        submitBtnHeight, 
        10
      );
      drawingContext.fill();
      drawingContext.restore();
      
      // Button text with retro style
        fill(255);
        textSize(20);
      textAlign(CENTER, CENTER);
      text("Submit to Leaderboard", width / 2, submitBtnY + submitBtnHeight / 2);
        
        // Store button bounds for click detection
      this.submitButtonBounds = {
        x: submitBtnX,
        y: submitBtnY,
        width: submitBtnWidth,
        height: submitBtnHeight
      };
      
      // Try again button with retro styling
        let tryAgainBtnX = width / 2 - 100;
      let tryAgainBtnY = height / 2 + 90;
        let tryAgainBtnWidth = 200;
      let tryAgainBtnHeight = 50;
      
      // Check if mouse is hovering over button
      let isTryAgainHovering = 
          mouseX >= tryAgainBtnX && 
          mouseX <= tryAgainBtnX + tryAgainBtnWidth &&
          mouseY >= tryAgainBtnY && 
          mouseY <= tryAgainBtnY + tryAgainBtnHeight;
      
      // Button gradient with hover effect and retro styling
      drawingContext.save();
        let tryAgainGradient = drawingContext.createLinearGradient(
          tryAgainBtnX, tryAgainBtnY, 
          tryAgainBtnX, tryAgainBtnY + tryAgainBtnHeight
        );
      
      if (isTryAgainHovering) {
        // Brighter gradient when hovering
        tryAgainGradient.addColorStop(0, '#ff5555');
        tryAgainGradient.addColorStop(1, '#cc2222');
        
        // Add glow effect on hover
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'rgba(255, 100, 100, 0.7)';
      } else {
        // Normal gradient
        tryAgainGradient.addColorStop(0, '#dd3333');
        tryAgainGradient.addColorStop(1, '#aa1111');
      }
      
        drawingContext.fillStyle = tryAgainGradient;
        
        // Button with rounded corners
      drawingContext.beginPath();
      drawingContext.roundRect(
        tryAgainBtnX, 
        tryAgainBtnY, 
        tryAgainBtnWidth, 
        tryAgainBtnHeight, 
        10
      );
      drawingContext.fill();
      drawingContext.restore();
      
      // Button text with retro style
        fill(255);
      textSize(24);
      textAlign(CENTER, CENTER);
      text("PLAY AGAIN", width / 2, tryAgainBtnY + tryAgainBtnHeight / 2);
        
        // Store button bounds for click detection
        this.tryAgainButtonBounds = {
          x: tryAgainBtnX,
          y: tryAgainBtnY,
          width: tryAgainBtnWidth,
          height: tryAgainBtnHeight
        };
      
      // View Leaderboard button with retro styling
      let leaderboardBtnX = width / 2 - 150;
      let leaderboardBtnY = height / 2 + 160;
      let leaderboardBtnWidth = 300;
      let leaderboardBtnHeight = 50;
      
      // Check if mouse is hovering over button
      let isLeaderboardHovering = 
          mouseX >= leaderboardBtnX && 
          mouseX <= leaderboardBtnX + leaderboardBtnWidth &&
          mouseY >= leaderboardBtnY && 
          mouseY <= leaderboardBtnY + leaderboardBtnHeight;
      
      // Button gradient with hover effect and retro styling
      drawingContext.save();
      let leaderboardGradient = drawingContext.createLinearGradient(
        leaderboardBtnX, leaderboardBtnY, 
        leaderboardBtnX, leaderboardBtnY + leaderboardBtnHeight
      );
      
      if (isLeaderboardHovering) {
        // Brighter gradient when hovering
        leaderboardGradient.addColorStop(0, '#00aaff');
        leaderboardGradient.addColorStop(1, '#0066cc');
        
        // Add glow effect on hover
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'rgba(0, 150, 255, 0.7)';
      } else {
        // Normal gradient
        leaderboardGradient.addColorStop(0, '#0088cc');
        leaderboardGradient.addColorStop(1, '#004488');
      }
      
      drawingContext.fillStyle = leaderboardGradient;
      
      // Button with rounded corners
      drawingContext.beginPath();
      drawingContext.roundRect(
        leaderboardBtnX, 
        leaderboardBtnY, 
        leaderboardBtnWidth, 
        leaderboardBtnHeight, 
        10
      );
      drawingContext.fill();
      drawingContext.restore();
      
      // Button text with retro style
      fill(255);
      textSize(20);
      textAlign(CENTER, CENTER);
      text("VIEW LEADERBOARD", width / 2, leaderboardBtnY + leaderboardBtnHeight / 2);
      
      // Store button bounds for click detection
      this.leaderboardButtonBounds = {
        x: leaderboardBtnX,
        y: leaderboardBtnY,
        width: leaderboardBtnWidth,
        height: leaderboardBtnHeight
      };
      
      pop();
    }

    handleKeyPress() {
      try {
        if (this.state === 'start' && !this.emailEntered) {
          // Handle email input on start screen
            if (keyCode === BACKSPACE) {
            if (this.cursorPosition > 0) {
              // Remove character at cursor position
              this.playerEmail = this.playerEmail.substring(0, this.cursorPosition - 1) + 
                                this.playerEmail.substring(this.cursorPosition);
              this.cursorPosition--;
            }
            return;
            } else if (keyCode === ENTER) {
            this.validateAndSetEmail();
            return;
          } else if (keyCode === LEFT_ARROW) {
            // Move cursor left
            if (this.cursorPosition > 0) {
              this.cursorPosition--;
            }
            return;
          } else if (keyCode === RIGHT_ARROW) {
            // Move cursor right
            if (this.cursorPosition < this.playerEmail.length) {
              this.cursorPosition++;
            }
            return;
          } else {
            // Handle all other keys including period/dot
            let charToAdd = "";
            
            // Direct mapping for special characters and numbers
            if (key === '.') charToAdd = '.';
            else if (key === '@') charToAdd = '@';
            else if (key === '-') charToAdd = '-';
            else if (key === '_') charToAdd = '_';
            else if (key.length === 1) { // Single character keys (letters, numbers)
              const validEmailRegex = /[a-zA-Z0-9@._\-]/;
              if (validEmailRegex.test(key)) {
                charToAdd = key;
              }
            }
            
            // If we have a valid character to add
            if (charToAdd) {
              // Insert at cursor position
              this.playerEmail = this.playerEmail.substring(0, this.cursorPosition) + 
                                charToAdd + 
                                this.playerEmail.substring(this.cursorPosition);
              this.cursorPosition++;
            }
          }
        } else if (this.state === 'playing') {
          if (keyCode === 32) { // Space bar
            this.player.shooting = true;
          }
        }
      } catch (error) {
        console.error("Error in handleKeyPress:", error);
        // Try to recover
        this.resetGame();
      }
    }
    
    handleKeyRelease() {
      if (this.state === 'playing') {
        if (keyCode === 32) { // Space bar
          this.player.shooting = false;
        }
      }
    }
    
    handleMouseClick() {
      try {
        // Check if we're in the leaderboard state
        if (this.state === 'leaderboard') {
          // Check if refresh button was clicked
          if (this.refreshButtonBounds &&
              mouseX >= this.refreshButtonBounds.x &&
              mouseX <= this.refreshButtonBounds.x + this.refreshButtonBounds.width &&
              mouseY >= this.refreshButtonBounds.y &&
              mouseY <= this.refreshButtonBounds.y + this.refreshButtonBounds.height) {
            console.log("Refresh button clicked");
            // Manually refresh leaderboard data
            this.fetchLeaderboard();
            return;
          }
          
          // Check if back button was clicked
          if (this.backButtonBounds &&
              mouseX >= this.backButtonBounds.x &&
              mouseX <= this.backButtonBounds.x + this.backButtonBounds.width &&
              mouseY >= this.backButtonBounds.y &&
              mouseY <= this.backButtonBounds.y + this.backButtonBounds.height) {
            console.log("Back button clicked");
            // Return to game over or start screen
            this.state = this.previousState || 'start';
            return;
          }
          
          return;
        }
        
        // Check if we're on the start screen
        if (this.state === 'start') {
          if (!this.emailEntered) {
            // Check if email input field was clicked to set focus
            if (this.emailInputBounds && 
                mouseX >= this.emailInputBounds.x && 
                mouseX <= this.emailInputBounds.x + this.emailInputBounds.width &&
                mouseY >= this.emailInputBounds.y && 
                mouseY <= this.emailInputBounds.y + this.emailInputBounds.height) {
              // Calculate cursor position based on click position
              let clickX = mouseX - (this.emailInputBounds.x + 40); // Adjust for icon space
              
              // Find the closest character position to the click
              let closestPos = 0;
              let minDist = Number.MAX_VALUE;
              
              for (let i = 0; i <= this.playerEmail.length; i++) {
                let charWidth = textWidth(this.playerEmail.substring(0, i));
                let dist = Math.abs(clickX - charWidth);
                if (dist < minDist) {
                  minDist = dist;
                  closestPos = i;
                }
              }
              
              this.cursorPosition = closestPos;
            }
            
            // Check if submit email button was clicked
            if (this.submitEmailButtonBounds && 
                mouseX >= this.submitEmailButtonBounds.x && 
                mouseX <= this.submitEmailButtonBounds.x + this.submitEmailButtonBounds.width &&
                mouseY >= this.submitEmailButtonBounds.y && 
                mouseY <= this.submitEmailButtonBounds.y + this.submitEmailButtonBounds.height) {
              this.validateAndSetEmail();
            }
          } else {
            // Check if start game button was clicked
            if (this.startButtonBounds && 
                mouseX >= this.startButtonBounds.x && 
                mouseX <= this.startButtonBounds.x + this.startButtonBounds.width &&
                mouseY >= this.startButtonBounds.y && 
                mouseY <= this.startButtonBounds.y + this.startButtonBounds.height) {
              this.startGame();
            }
          }
          
          // Check if leaderboard button was clicked on start screen
          if (this.startLeaderboardButtonBounds &&
              mouseX >= this.startLeaderboardButtonBounds.x &&
              mouseX <= this.startLeaderboardButtonBounds.x + this.startLeaderboardButtonBounds.width &&
              mouseY >= this.startLeaderboardButtonBounds.y &&
              mouseY <= this.startLeaderboardButtonBounds.y + this.startLeaderboardButtonBounds.height) {
            console.log("View leaderboard button clicked from start screen");
            // Fetch leaderboard data if not already loaded
            this.fetchLeaderboard();
            // Store previous state
            this.previousState = 'start';
            // Switch to leaderboard state
            this.state = 'leaderboard';
            return;
          }
        } else if (this.state === 'gameOver') {
          // Check if submit to leaderboard button was clicked
          if (this.submitScoreButtonBounds && 
              mouseX >= this.submitScoreButtonBounds.x && 
              mouseX <= this.submitScoreButtonBounds.x + this.submitScoreButtonBounds.width &&
              mouseY >= this.submitScoreButtonBounds.y && 
              mouseY <= this.submitScoreButtonBounds.y + this.submitScoreButtonBounds.height) {
            this.submitScore();
          }
          
          // Check if leaderboard button was clicked
          if (this.leaderboardButtonBounds &&
              mouseX >= this.leaderboardButtonBounds.x &&
              mouseX <= this.leaderboardButtonBounds.x + this.leaderboardButtonBounds.width &&
              mouseY >= this.leaderboardButtonBounds.y &&
              mouseY <= this.leaderboardButtonBounds.y + this.leaderboardButtonBounds.height) {
            console.log("View leaderboard button clicked");
            // Fetch leaderboard data
            this.fetchLeaderboard();
            // Store previous state
            this.previousState = 'gameOver';
            // Switch to leaderboard state
            this.state = 'leaderboard';
            return;
          }
          
          // Check if restart button was clicked
          if (this.restartButtonBounds && 
              mouseX >= this.restartButtonBounds.x && 
              mouseX <= this.restartButtonBounds.x + this.restartButtonBounds.width &&
              mouseY >= this.restartButtonBounds.y && 
              mouseY <= this.restartButtonBounds.y + this.restartButtonBounds.height) {
            this.resetGame();
          }
          
          // Check if share button was clicked
          if (this.shareButtonBounds && 
              mouseX >= this.shareButtonBounds.x && 
              mouseX <= this.shareButtonBounds.x + this.shareButtonBounds.width &&
              mouseY >= this.shareButtonBounds.y && 
              mouseY <= this.shareButtonBounds.y + this.shareButtonBounds.height) {
            this.shareScore();
          }
        }
      } catch (error) {
        console.error("Error in handleMouseClick:", error);
      }
    }
    
    // New method to validate and set email
    validateAndSetEmail() {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(this.playerEmail)) {
        this.emailEntered = true;
      } else {
        // Could add visual feedback for invalid email
        console.error("Invalid email format");
      }
    }
    
    startGame() {
      this.state = 'playing';
      this.score = 0;
      this.lives = 3;
      this.level = 1;
      this.enemiesKilled = 0;
      this.levelUpThreshold = 10;
      this.player.reset();
    }
    
    resetGame() {
      try {
        // Reset game state
        this.state = 'playing';
        this.score = 0;
        this.lives = 3; // Maximum of 3 lives
        this.level = 1;
        this.enemiesKilled = 0;
        this.levelUpThreshold = 10;
        
        // Reset player
        this.player = new Player();
        this.player.lives = 3; // Ensure player lives is set to 3
        
        // Clear game objects
        this.bullets = [];
        this.enemies = [];
        this.explosions = [];
        this.powerups = [];
        
        console.log("Game reset. Lives:", this.lives, "Player lives:", this.player.lives);
      } catch (error) {
        console.error("Error in resetGame:", error);
      }
    }
    
    async submitScore() {
      try {
        console.log("Attempting to submit score...");
        
        // If in offline mode, just show success message without actually submitting
        if (useOfflineMode) {
          console.log("In offline mode - simulating score submission");
          this.submissionStatus = "success";
          
          // Add player score to mock leaderboard data
          this.leaderboardData.push({
            email: this.playerEmail,
            score: this.score,
            created_at: new Date().toISOString()
          });
          
          // Sort the leaderboard data by score (descending)
          this.leaderboardData.sort((a, b) => b.score - a.score);
          
          // Limit to top 10
          if (this.leaderboardData.length > 10) {
            this.leaderboardData = this.leaderboardData.slice(0, 10);
          }
          
          // Show leaderboard after "successful" submission
          this.showLeaderboard();
          return;
        }
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.playerEmail)) {
          console.error("Invalid email format:", this.playerEmail);
          this.submissionStatus = "error";
          return;
        }
        
        this.isSubmittingScore = true;
        console.log("Submitting score:", this.score, "for email:", this.playerEmail);
        
        // Use Netlify function endpoint instead of direct Supabase call
        const apiUrl = 'https://cosmic-defender.netlify.app/.netlify/functions/submitScore';
        console.log("Submitting score to:", apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: this.playerEmail,
            score: this.score,
            game_version: '1.0'
          })
        });
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
          console.log("Score submitted successfully");
          this.submissionStatus = "success";
          
          // Fetch updated leaderboard
          await this.fetchLeaderboard();
          
          // Show leaderboard after successful submission
          this.showLeaderboard();
        } else if (result.unchanged) {
          console.log("Score unchanged (not higher than previous)");
          this.submissionStatus = "unchanged";
          
          // Still fetch updated leaderboard and show it
          await this.fetchLeaderboard();
          this.showLeaderboard();
        } else {
          console.error("Error submitting score:", result.error);
          this.submissionStatus = "error";
        }
        
        this.isSubmittingScore = false;
      } catch (error) {
        console.error("Error in submitScore:", error);
        this.isSubmittingScore = false;
        this.submissionStatus = "error";
      }
    }
    
    showLeaderboard() {
      // Fetch leaderboard data if not already loaded
      if (this.leaderboardData.length === 0) {
        this.fetchLeaderboard();
      }
      
      // Switch to leaderboard state
      this.state = 'leaderboard';
    }
    
    shareScore() {
      try {
        // Create the share message with the actual score
        const message = this.shareMessage.replace('{score}', this.score);
        
        // Create the Twitter share URL
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
        
        // Open in a new window
        window.open(shareUrl, '_blank');
      } catch (error) {
        console.error("Error sharing score:", error);
      }
    }

    drawLeaderboard() {
      push();
      textFont('Orbitron');
      
      // Draw starfield background behind the panel
      this.drawStars();
      
      // Draw background panel with glow effect
      drawingContext.shadowBlur = 20;
      drawingContext.shadowColor = 'rgba(0, 100, 255, 0.5)';
      fill(0, 0, 20, 220);
      stroke(0, 100, 200);
      strokeWeight(2);
      rect(width * 0.1, height * 0.1, width * 0.8, height * 0.8, 10);
      drawingContext.shadowBlur = 0;
      
      // Title with retro styling
      textAlign(CENTER);
      let leaderboardX = width / 2;
      let leaderboardY = height * 0.15;
      
      // Outer glow
      for (let i = 5; i > 0; i--) {
        let alpha = map(i, 5, 0, 20, 80);
        fill(100, 200, 255, alpha);
        textSize(40 + i);
        text("LEADERBOARD", leaderboardX, leaderboardY);
      }
      
      // Gradient fill for main text
      drawingContext.save();
      let gradient = drawingContext.createLinearGradient(0, leaderboardY - 20, 0, leaderboardY + 20);
      gradient.addColorStop(0, '#00ffff');
      gradient.addColorStop(0.5, '#0088ff');
      gradient.addColorStop(1, '#0044ff');
      
      drawingContext.fillStyle = gradient;
      textSize(40);
      text("LEADERBOARD", leaderboardX, leaderboardY);
      
      // Add outline
      noFill();
      strokeWeight(2);
      stroke(255);
      text("LEADERBOARD", leaderboardX, leaderboardY);
      drawingContext.restore();
      
      // Real-time indicator
      let indicatorX = width * 0.8;
      let indicatorY = height * 0.15;
      let pulseSize = 8 + sin(frameCount * 0.1) * 2; // Pulsing effect
      
      fill(0, 255, 0, 200);
      noStroke();
      ellipse(indicatorX - 50, indicatorY, pulseSize, pulseSize);
      
      fill(200, 255, 200);
      textAlign(LEFT);
      textSize(12);
      text("LIVE", indicatorX - 40, indicatorY + 5);
      
      // Display leaderboard entries or message
      let startY = height * 0.25;
      let rowHeight = 40;
      
      if (this.leaderboardError) {
        // Show error message
        fill(255, 100, 100);
        textAlign(CENTER);
        textSize(20);
        text(this.leaderboardErrorMessage, width/2, height/2);
        text("Check console for details", width/2, height/2 + 30);
      } else if (!this.leaderboardData || this.leaderboardData.length === 0) {
        // Show loading or no data message
        fill(200, 200, 200);
        textAlign(CENTER);
        textSize(20);
        text("Loading leaderboard data...", width/2, height/2);
        
        // Loading animation
        push();
        translate(width/2, height/2 + 50);
        rotate(frameCount * 0.05);
        noFill();
        stroke(0, 150, 255);
        strokeWeight(2);
        arc(0, 0, 30, 30, 0, PI + HALF_PI);
        pop();
        
        // If it's been a while, show a message about possible connection issues
        if (frameCount % 180 > 90) { // Blink the message
          text("If this persists, there may be connection issues", width/2, height/2 + 80);
        }
      } else {
        // Display column headers
        textAlign(LEFT);
        textSize(20);
        
        // Header gradient
        drawingContext.save();
        let headerGradient = drawingContext.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
        headerGradient.addColorStop(0, '#00ffff');
        headerGradient.addColorStop(1, '#0088ff');
        drawingContext.fillStyle = headerGradient;
        
        text("RANK", width * 0.2, startY);
        text("PLAYER", width * 0.3, startY);
        text("SCORE", width * 0.7, startY);
        text("DATE", width * 0.8, startY);
        drawingContext.restore();
        
        // Horizontal line under headers
        stroke(0, 150, 255, 150);
        strokeWeight(1);
        line(width * 0.15, startY + 10, width * 0.85, startY + 10);
        
        // Display entries
        startY += 30;
        for (let i = 0; i < this.leaderboardData.length; i++) {
          const entry = this.leaderboardData[i];
          
          // Highlight row if it's the current player
          if (entry.email === this.playerEmail) {
            // Animated highlight for current player
            let highlightAlpha = 100 + sin(frameCount * 0.05) * 50;
            fill(0, 100, 200, highlightAlpha);
            noStroke();
            rect(width * 0.15, startY - 20, width * 0.7, rowHeight, 5);
          }
          
          // Rank with medal for top 3
          textAlign(LEFT);
          if (i < 3) {
            let medalColors = [
              color(255, 215, 0),  // Gold
              color(192, 192, 192), // Silver
              color(205, 127, 50)   // Bronze
            ];
            
            // Draw medal icon
            fill(medalColors[i]);
            stroke(255, 255, 255, 100);
            strokeWeight(1);
            ellipse(width * 0.18, startY - 5, 22, 22);
            
            // Medal number
            fill(0);
            noStroke();
            textAlign(CENTER);
            textSize(14);
            text(i+1, width * 0.18, startY);
            
            // Rank text
            textAlign(LEFT);
            fill(medalColors[i]);
            textSize(22);
            text(`#${i+1}`, width * 0.2, startY);
          } else {
            fill(150, 150, 150);
            textSize(18);
            text(`#${i+1}`, width * 0.2, startY);
          }
          
          // Email (username) - show only first part before @
          let username = entry.email.split('@')[0];
          // If username is too long, truncate it
          if (username.length > 15) {
            username = username.substring(0, 12) + '...';
          }
          
          fill(255);
          textSize(18);
          text(username, width * 0.3, startY);
          
          // Score with gradient for top 3
          textAlign(LEFT);
          if (i < 3) {
            drawingContext.save();
            let scoreGradient = drawingContext.createLinearGradient(0, startY - 15, 0, startY + 5);
            
            if (i === 0) {
              scoreGradient.addColorStop(0, '#ffff00');
              scoreGradient.addColorStop(1, '#ffa500');
            } else if (i === 1) {
              scoreGradient.addColorStop(0, '#ffffff');
              scoreGradient.addColorStop(1, '#cccccc');
            } else {
              scoreGradient.addColorStop(0, '#cd7f32');
              scoreGradient.addColorStop(1, '#8b4513');
            }
            
            drawingContext.fillStyle = scoreGradient;
            textSize(22);
            text(entry.score, width * 0.7, startY);
            drawingContext.restore();
          } else {
            fill(200, 200, 200);
            textSize(18);
            text(entry.score, width * 0.7, startY);
          }
          
          // Date
          fill(150, 150, 150);
          textSize(14);
          let date = new Date(entry.created_at);
          let dateStr = `${date.getMonth()+1}/${date.getDate()}/${date.getFullYear().toString().substr(-2)}`;
          text(dateStr, width * 0.8, startY);
          
          startY += rowHeight;
        }
        
        // Show message if using mock data
        if (this.leaderboardErrorMessage && (this.leaderboardErrorMessage.includes("offline") || this.leaderboardErrorMessage.includes("demo"))) {
          fill(255, 200, 0);
          textAlign(CENTER);
          textSize(14);
          text(this.leaderboardErrorMessage, width/2, height * 0.8);
          
          if (useOfflineMode) {
            textSize(12);
            fill(200, 200, 200);
            text("GitHub Pages version - Leaderboard is in demo mode", width/2, height * 0.83);
          }
        }
      }
      
      // Refresh button
      let refreshBtnX = width * 0.85;
      let refreshBtnY = height * 0.2;
      let refreshBtnSize = 30;
      
      // Store button bounds for click detection
      this.refreshButtonBounds = {
        x: refreshBtnX - refreshBtnSize/2,
        y: refreshBtnY - refreshBtnSize/2,
        width: refreshBtnSize,
        height: refreshBtnSize
      };
      
      // Check if mouse is over refresh button
      let isRefreshHovering = mouseX >= this.refreshButtonBounds.x && 
                             mouseX <= this.refreshButtonBounds.x + this.refreshButtonBounds.width &&
                             mouseY >= this.refreshButtonBounds.y && 
                             mouseY <= this.refreshButtonBounds.y + this.refreshButtonBounds.height;
      
      // Draw refresh button
      stroke(isRefreshHovering ? '#00ffff' : '#0088cc');
      strokeWeight(2);
      fill(0, 0, 30, 200);
      ellipse(refreshBtnX, refreshBtnY, refreshBtnSize, refreshBtnSize);
      
      // Draw refresh icon
      push();
      translate(refreshBtnX, refreshBtnY);
      rotate(frameCount * 0.01); // Subtle rotation animation
      noFill();
      stroke(isRefreshHovering ? '#00ffff' : '#0088cc');
      strokeWeight(2);
      arc(0, 0, refreshBtnSize * 0.6, refreshBtnSize * 0.6, 0, PI + HALF_PI);
      // Arrow head
      line(refreshBtnSize * 0.15, -refreshBtnSize * 0.1, refreshBtnSize * 0.3, 0);
      line(refreshBtnSize * 0.15, refreshBtnSize * 0.1, refreshBtnSize * 0.3, 0);
      pop();
      
      // Back button with retro styling
      let backButtonX = width * 0.5;
      let backButtonY = height * 0.85;
      let backButtonWidth = 150;
      let backButtonHeight = 50;
      
      // Store button bounds for click detection
      this.backButtonBounds = {
        x: backButtonX - backButtonWidth/2,
        y: backButtonY - backButtonHeight/2,
        width: backButtonWidth,
        height: backButtonHeight
      };
      
      // Check if mouse is over button
      let isHovering = mouseX >= this.backButtonBounds.x && 
                      mouseX <= this.backButtonBounds.x + this.backButtonBounds.width &&
                      mouseY >= this.backButtonBounds.y && 
                      mouseY <= this.backButtonBounds.y + this.backButtonBounds.height;
      
      // Button background with glow when hovering
      drawingContext.save();
      if (isHovering) {
        drawingContext.shadowBlur = 15;
        drawingContext.shadowColor = 'rgba(0, 150, 255, 0.8)';
      }
      
      let buttonGradient = drawingContext.createLinearGradient(
        backButtonX - backButtonWidth/2, backButtonY,
        backButtonX + backButtonWidth/2, backButtonY
      );
      buttonGradient.addColorStop(0, '#004080');
      buttonGradient.addColorStop(0.5, '#0066cc');
      buttonGradient.addColorStop(1, '#004080');
      
      drawingContext.fillStyle = buttonGradient;
      rect(backButtonX - backButtonWidth/2, backButtonY - backButtonHeight/2, 
           backButtonWidth, backButtonHeight, 10);
      drawingContext.restore();
      
      // Button text
      textAlign(CENTER, CENTER);
      textSize(20);
      
      if (isHovering) {
        fill(255, 255, 255);
      } else {
        fill(200, 200, 255);
      }
      
      text("BACK", backButtonX, backButtonY);
      
      pop();
    }
    
    async fetchLeaderboard() {
      try {
        console.log("Fetching leaderboard data...");
        
        // Check if we're in offline mode
        if (useOfflineMode) {
          console.log("Using offline mode for leaderboard");
          this.leaderboardData = [
            { email: "player1@example.com", score: 5000, created_at: new Date().toISOString() },
            { email: "player2@example.com", score: 4500, created_at: new Date().toISOString() },
            { email: "player3@example.com", score: 4000, created_at: new Date().toISOString() },
            { email: "player4@example.com", score: 3800, created_at: new Date().toISOString() },
            { email: "player5@example.com", score: 3600, created_at: new Date().toISOString() },
            { email: this.playerEmail || "you@example.com", score: 3500, created_at: new Date().toISOString() },
            { email: "player6@example.com", score: 3200, created_at: new Date().toISOString() },
            { email: "player7@example.com", score: 2800, created_at: new Date().toISOString() },
            { email: "player8@example.com", score: 2500, created_at: new Date().toISOString() },
            { email: "player9@example.com", score: 2000, created_at: new Date().toISOString() }
          ];
          this.leaderboardError = false;
          this.leaderboardErrorMessage = "Using demo data (GitHub Pages version)";
          return;
        }
        
        // Show loading state
        this.leaderboardData = [];
        this.leaderboardError = false;
        this.leaderboardErrorMessage = "Loading leaderboard data...";
        
        // Use Netlify function endpoint instead of direct Supabase call
        const apiUrl = 'https://cosmic-defender.netlify.app/.netlify/functions/getLeaderboard';
        console.log("Fetching leaderboard from:", apiUrl);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data) {
          console.log("Leaderboard data received:", data.length, "entries");
          this.leaderboardData = data;
          this.leaderboardError = false;
        } else {
          console.error("No data received from leaderboard API");
          this.leaderboardError = true;
          this.leaderboardErrorMessage = "No data received from server";
        }
      } catch (error) {
        console.error("Error in fetchLeaderboard:", error);
        this.leaderboardError = true;
        this.leaderboardErrorMessage = "Error loading leaderboard";
        
        // Create mock data for testing or when offline
        if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
          console.log("Creating mock leaderboard data due to error");
          this.leaderboardData = [
            { email: "player1@example.com", score: 5000, created_at: new Date().toISOString() },
            { email: "player2@example.com", score: 4500, created_at: new Date().toISOString() },
            { email: "player3@example.com", score: 4000, created_at: new Date().toISOString() },
            { email: this.playerEmail || "you@example.com", score: 3500, created_at: new Date().toISOString() }
          ];
          this.leaderboardError = false;
          this.leaderboardErrorMessage = "Using offline data (demo mode)";
        }
      }
    }
  }
  
  // p5.js setup and draw functions
  let game;
  
  function setup() {
    createCanvas(1040, 740);
    
    // Initialize Supabase client
    try {
      console.log("Attempting to initialize Supabase with URL:", SUPABASE_URL);
      supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);
      console.log("Supabase initialized successfully");
      
      // Test connection
      supabase.from('leaderboard').select('count').limit(1)
        .then(response => {
          if (response.error) {
            console.error("Supabase connection test failed:", response.error);
          } else {
            console.log("Supabase connection test successful:", response);
            // Set up real-time subscription for leaderboard updates
            setupRealtimeSubscription();
          }
        })
        .catch(error => {
          console.error("Supabase connection test error:", error);
        });
    } catch (error) {
      console.error("Error initializing Supabase:", error);
    }
    
    game = new Game();
    
    // Add error handling for the main game loop, but only for critical errors
    window.onerror = function(message, source, lineno, colno, error) {
      console.error(`Game error at line ${lineno}:`, message);
      
      // Log the error but don't change game state
      // This prevents the game from ending prematurely
      console.log("Error detected, but continuing game");
      
      return true; // Prevents the default browser error handling
    };
  }
  
  function draw() {
    try {
      // Clear the background first to prevent rendering artifacts
      background(0); // Black space background
      
      // Update game state
      if (game.state === 'playing') {
      game.update();
      }
      
      // Draw game
      game.draw();
    } catch (error) {
      console.error("Error in main game loop:", error);
    }
  }
  
  function keyPressed() {
    game.handleKeyPress();
    return false; // Prevent default browser behavior
  }
  
  function keyReleased() {
    if (game.state === 'playing') {
      if (keyCode === 32) {
        game.player.shooting = false;
      }
    }
    return false; // Prevent default browser behavior
  }
  
  function mouseClicked() {
    game.handleMouseClick();
    return false; // Prevent default browser behavior
  }
  
  function mouseMoved() {
    // This function will track mouse movement for hover effects
    return false; // Prevent default browser behavior
  }