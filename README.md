# Cosmic Defender - Space Shooter Game

A fast-paced space shooter game with powerups, shields, and a global leaderboard.

## Play the Game

You can play the game online at: [Cosmic Defender](https://YOUR_GITHUB_USERNAME.github.io/cosmic-defender/)

## Game Features

- Retro-style space shooter gameplay
- Multiple enemy types
- Power-ups and shields
- Progressive difficulty levels
- Global leaderboard to compete with other players
- Responsive controls

## How to Play

1. Enter your email to start the game
2. Use arrow keys or WASD to move your spaceship
3. Press SPACE to shoot
4. Collect power-ups to enhance your weapons and defenses
5. Avoid or destroy enemy ships
6. Submit your score to the global leaderboard

## Note About GitHub Pages Version

When playing the game hosted on GitHub Pages, the leaderboard will operate in demo mode with sample data. This is because GitHub Pages has limitations with backend connections. For the full experience with a real leaderboard, you can:

1. Clone the repository
2. Set up your own Supabase backend (instructions below)
3. Run the game locally or on your own server

## Setting Up Supabase Backend (Optional)

If you want to set up your own leaderboard:

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the following SQL in the SQL Editor:

```sql
CREATE TABLE leaderboard (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  score INTEGER NOT NULL,
  game_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX leaderboard_score_idx ON leaderboard(score DESC);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard" 
  ON leaderboard FOR SELECT USING (true);

CREATE POLICY "Anyone can insert into leaderboard" 
  ON leaderboard FOR INSERT WITH CHECK (true);
```

4. Update the `SUPABASE_URL` and `SUPABASE_KEY` variables in sketch.js with your project details

## Technologies Used

- HTML5
- CSS3
- JavaScript (p5.js)
- Supabase for the leaderboard backend

## Development

This game was developed as a fun project to explore game development with JavaScript and p5.js.

## Credits

- Game design and development: [Your Name]
- Powered by p5.js and Supabase 