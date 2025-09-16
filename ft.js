const quotes = [
    `"Just have fun here and download my digital merch." - RR`,
    `"ALIBABAEXPRESS" - Ali Heiba`,
    `"In Africa, every day is 24 hrs" - Mike Cox`, 
    `"I wrote this with 2 weeks left of year 8 (most useless year ever) SCHOOL SUCKS!!!, Year 6 was peak" - Aydin Desai`,
    `"We are Forsaken - Not1x1x1x1"`,
    `"I AM KING CARROT, DOWN WITH THE POTATO KING" - THE GLORIOUS CARROT KING`,
    `"I AM YOUR KING, KING POTATO!!!!" - King Potato`,
    `"RR is Benn's Cookie" - Benn Cern Tang`,
    `"I like cats" - Aritro Roy`,
    `"Roses are red, violets are blue, RR made this website, we made it for you" - Murdoch Mackenzie`,
    `"Alex likes planes, cats and this website" - Alex Stankov`,
    `"Still hungry" - Y.`,
    `"Guess what I pulled? A push door." - AA`,
    `"Happiness starts with a smile and this website makes Ethan smile" - Ethan Welch`,
    `"if ur reading this ur a sharkbee" - Hani Shen`,
    `"Im going to eat u" - Quijun Tang`,
    `"Ronan" - Ronan Bingham`,
    `"Hippitie hoppitie, this website is amazing for my property!" - Nico Smit`,
    `"Nico likes to play bus driver simulator" - Aditya Joseph Philip`,
    `"Buy my baby oil and see diddy.com" - Pranil Diddi`,
    `"With great power comes great responsibility...im not responsible" - Jenson Cooper`,
    `"Roses are red violets are blue and this website is a cannon event for your life and 9,11 too" - Finn Tarmar`,
    `"who ever is reading this plays games in class" - Ethan Lai`,
    `"Why did Benn have to leave me" - Rayyan Asif`,
    `"I like year 5s" - Douglas Clow`,
    `"Better than Poki" - Dhruv Mondal`,
    `"Bob and Dennis' favorite website" - Anya Kumar`,
    `"Kick Paul Out!!!" - Spencer Samuel`,
    `"If you dont wear how did the floor taste boxers your not legit" - Ali Elnaggar`,
    `"I am officially tired of school" - Magdalena Slavkova`,
    `"Lil phoebeeeee" - Carl Deeb`,
    `"tihe" - Xitong Zhang`,
    `"Michaelsoft Binbows 95" - Agastyn Manivannan`,
    `"I like stacking Tetris blocks & Tomb in masks" - RE`,
    `"Hatta Rules" - Aiden from TAC`,
    `"I am the greatest - LeBron" - Enbo Zeus`,
    `"King" - Izak - Michael Zinn`,
    `"Chicken Jockey" - Jack Black`,
    `"It’s crazy how everyone in Year 8 plays on this website now" - HD`,
    `"A man who doesn't love fishing is not a man" - Sergio Christodoulou (The one who banned the web)`,
    `"When she calls me passionate, unique, successful, special and youthful" - Louis Jack`,
    `"Papas wingeria" - Oliver Wheeler`,
    `"I pray on their success" - Abdulaziz Alayaseh`,
    `"Lebroooooooooon" - Alexander Akidil`,
    `"Literally no one will ever call u those louis." - Esme Logan`,
    `"If the world hurts you don’t hurt it back just call Fernando (AKA the Muscle Lord) your problems will be solved" - Benjamin Kuit`,
    `"I am Mujtaba" - Mujtaba`,
    `"Call me short one more time and I’ll bite your toes" - Lynn El Sahmarani`,
    `"Im way too charged" - Yassen Askar`,
    `"Ts website is so tuff" - Oliver Sinden`,
    `"Go back to work you jobless bum" - Joshua Paul`,
];
// —————— CONFIG ——————
const characters         = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+';
const speed              = 40;  // ms between frames
const lettersPerTick     = 1;   // letters revealed per frame
const scramblePhase1     = 5;   // frames of “old‐length” scramble
const scramblePhase2Extra = 3;  // extra frames during grow/shrink scramble

let currentQuoteIndex = Math.floor(Math.random() * quotes.length);

const quoteDisplay   = document.getElementById('quote-display');
const allQuotesDiv   = document.getElementById('all-quotes');
const expandButton   = document.getElementById('expand-button');
const collapseButton = document.getElementById('collapse-button');


// —————— TRANSITION FUNCTION ——————
/**
 * 1) Decrypt old text fully (if not already)
 * 2) Phase 1: scramble old‐length into ascii
 * 3) Phase 2: scramble & adjust to new length
 * 4) Phase 3: decrypt into newText
 */
async function transitionQuote(el, newText) {
  const oldText = el.innerText;
  const oldLen  = oldText.length;
  const newLen  = newText.length;
  const maxLen  = Math.max(oldLen, newLen);

  // 0) Ensure we start fully decrypted
  el.innerText = oldText;

  // 1) Phase 1: scramble at old length
  await new Promise(res => {
    let frame = 0;
    function step1() {
      let s = '';
      for (let i = 0; i < oldLen; i++) {
        s += characters[Math.floor(Math.random() * characters.length)];
      }
      el.innerText = s;
      if (++frame < scramblePhase1) {
        setTimeout(step1, speed);
      } else {
        res();
      }
    }
    step1();
  });

  // 2) Phase 2: scramble & grow/shrink to maxLen
  await new Promise(res => {
    let frame = 0;
    const growFrames = Math.ceil(Math.abs(maxLen - oldLen) / lettersPerTick);
    const total = growFrames + scramblePhase2Extra;

    function step2() {
      frame++;
      // compute current length: if new longer, grow; if shorter, shrink after scramblePhase2Extra
      let currLen;
      if (maxLen > oldLen) {
        // growing up to maxLen
        const grown = Math.min(frame, growFrames) * lettersPerTick;
        currLen = Math.min(oldLen + grown, maxLen);
      } else {
        // new shorter or equal: keep full oldLen until extra frames expire
        currLen = oldLen;
      }

      let s = '';
      for (let i = 0; i < currLen; i++) {
        s += characters[Math.floor(Math.random() * characters.length)];
      }
      el.innerText = s;

      if (frame < total) {
        setTimeout(step2, speed);
      } else {
        // clear to prepare decrypt
        el.innerText = '';
        res();
      }
    }
    step2();
  });

  // 3) Phase 3: decrypt into newText
  await new Promise(res => {
    let revealed = 0;
    function step3() {
      let out = '';
      for (let i = 0; i < maxLen; i++) {
        if (i < revealed) {
          out += newText[i] || '';
        } else if ((newText[i] || '') === ' ') {
          out += ' ';
        } else {
          out += characters[Math.floor(Math.random() * characters.length)];
        }
      }
      el.innerText = out;
      revealed += lettersPerTick;
      if (revealed <= maxLen) {
        setTimeout(step3, speed);
      } else {
        el.innerText = newText; // clamp exactly
        res();
      }
    }
    step3();
  });
}


// —————— AUTO‑CYCLE LOOP ——————
async function startQuoteLoop() {
  // clear initially
  quoteDisplay.innerText = '';
  while (true) {
    // transition old → new
    await transitionQuote(quoteDisplay, quotes[currentQuoteIndex]);

    // wait 3s
    await new Promise(r => setTimeout(r, 3000));

    // advance index
    currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
  }
}


// —————— SHOW ALL / COLLAPSE ——————
async function showAllQuotes() {
  quoteDisplay.style.display   = 'none';
  expandButton.style.display   = 'none';
  collapseButton.style.display = 'inline-block';

  allQuotesDiv.innerHTML     = quotes.map(_ => `<p></p>`).join('');
  allQuotesDiv.style.display = 'block';

  const ps = Array.from(allQuotesDiv.children);
  ps.forEach((p, i) => {
    p.innerText = '';
    // stagger starts if desired
    setTimeout(() => transitionQuote(p, quotes[i]), i * 80);
  });
}

async function collapseQuotes() {
  allQuotesDiv.style.display   = 'none';
  expandButton.style.display   = 'inline-block';
  collapseButton.style.display = 'none';
  quoteDisplay.style.display   = 'block';

  await transitionQuote(quoteDisplay, quotes[currentQuoteIndex]);
}


// —————— INIT & EVENTS ——————
expandButton.addEventListener('click', showAllQuotes);
collapseButton.addEventListener('click', collapseQuotes);

document.addEventListener('DOMContentLoaded', () => {
  startQuoteLoop();
});
