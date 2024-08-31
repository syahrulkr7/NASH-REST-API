const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const Groq = require('groq-sdk');
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dns = require('dns').promises;
const { performance } = require('perf_hooks');
const fs = require('fs');
const app = express();
app.use(cors());
app.set('json spaces', 4);
const port = 3000;

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

//llama3-8b-8192 
const groq = new Groq({ apiKey: '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' });

app.get('/Llama', async (req, res) => {
  try {
    const query = req.query.q;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: query,
        },
      ],
      model: 'llama3-8b-8192',
    });

    res.json({
      response: chatCompletion.choices[0]?.message?.content || "Walang natanggap na sagot.",
    });
  } catch (error) {
    console.error('Error fetching chat completion:', error);
    res.status(500).json({ error: 'Nabigong makuha ang sagot.' });
  }
});

//mixtral convertional
const CONVERSATION_FILE = path.join(__dirname, 'mixtral.json');

app.use(express.json());

const loadConversations = () => {
  if (fs.existsSync(CONVERSATION_FILE)) {
    return JSON.parse(fs.readFileSync(CONVERSATION_FILE, 'utf8'));
  }
  return {};
};

const saveConversations = (conversations) => {
  fs.writeFileSync(CONVERSATION_FILE, JSON.stringify(conversations, null, 2), 'utf8');
};

app.get('/Mixtral', async (req, res) => {
  const userId = req.query.userId;
  const message = req.query.message;

  if (!userId || !message) {
    return res.status(400).json({ error: 'User ID and message are required.' });
  }

  const conversations = loadConversations();

  if (message.toLowerCase() === 'clear') {
    delete conversations[userId];
    saveConversations(conversations);
    return res.json({ response: 'Conversation cleared.' });
  }

  const history = conversations[userId] || [];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        ...history,
        {
          role: 'user',
          content: message,
        },
      ],
      model: 'mixtral-8x7b-32768',
    });

    const newMessage = chatCompletion.choices[0]?.message?.content || 'No response received.';
    conversations[userId] = [
      ...history,
      {
        role: 'user',
        content: message,
      },
      {
        role: 'assistant',
        content: newMessage,
      },
    ];

    saveConversations(conversations);

    res.json({
      response: newMessage,
    });
  } catch (error) {
    console.error('Error fetching chat completion:', error);
    res.status(500).json({ error: 'Failed to fetch response.' });
  }
});

//gemma-7b-it
app.get('/gemma', async (req, res) => {
  const prompt = req.query.prompt;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: 'gemma-7b-it',
    });

    const responseMessage = chatCompletion.choices[0]?.message?.content || 'No response received.';

    res.json({
      response: responseMessage,
    });
  } catch (error) {
    console.error('Error fetching chat completion:', error);
    res.status(500).json({ error: 'Failed to fetch response.' });
  }
});

//gpt3.5
axios.defaults.baseURL = 'https://deku-rest-api.gleeze.com';

app.use(express.json());

app.get('/gpt-3.5_turbo', async (req, res) => {
  const { prompt } = req.query;

  if (!prompt) {
    return res.status(400).json({ status: 400, message: 'Prompt is required' });
  }

  try {
    const response = await axios.get(`/new/gpt-3_5-turbo`, {
      params: { prompt }
    });
    const data = response.data;

    return res.json({
      result: {
        reply: data.result.reply
      }
    });
  } catch (error) {
    return res.status(500).json({ status: 500, message: 'An error occurred', error: error.message });
  }
});

//checkweb
const apikey = '254572';

app.get('/checkweb', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const start = performance.now();

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content') || 'No description available';

    const screenshotURL = `https://api.screenshotmachine.com?key=${apikey}&url=${encodeURIComponent(url)}&dimension=1024x768`;

    const responseTime = performance.now() - start;

    const ipAddress = await dns.lookup(new URL(url).hostname)
      .then(result => result.address)
      .catch(() => 'N/A');

    res.json({
      status: response.status,
      title,
      description,
      screenshotURL,
      contentLength: response.headers['content-length'] || 'N/A',
      contentType: response.headers['content-type'] || 'N/A',
      server: response.headers['server'] || 'N/A',
      lastModified: response.headers['last-modified'] || 'N/A',
      httpVersion: response.request.res.httpVersion || 'N/A',
      responseTime: `${responseTime.toFixed(2)} ms`,
      ipAddress,
      redirects: response.request.res.responseUrl || 'N/A',
      cookies: response.headers['set-cookie'] || 'N/A',
      cacheControl: response.headers['cache-control'] || 'N/A',
      eTag: response.headers['etag'] || 'N/A',
      contentEncoding: response.headers['content-encoding'] || 'N/A',
      connection: response.headers['connection'] || 'N/A'
    });
  } catch (error) {
    const responseTime = performance.now() - start;

    if (error.response) {
      res.json({
        status: error.response.status,
        title: null,
        description: null,
        screenshotURL: null,
        contentLength: error.response.headers['content-length'] || 'N/A',
        contentType: error.response.headers['content-type'] || 'N/A',
        server: error.response.headers['server'] || 'N/A',
        lastModified: error.response.headers['last-modified'] || 'N/A',
        httpVersion: error.response.request.res.httpVersion || 'N/A',
        responseTime: `${responseTime.toFixed(2)} ms`,
        ipAddress: 'N/A',
        redirects: error.response.request.res.responseUrl || 'N/A',
        cookies: error.response.headers['set-cookie'] || 'N/A',
        cacheControl: error.response.headers['cache-control'] || 'N/A',
        eTag: error.response.headers['etag'] || 'N/A',
        contentEncoding: error.response.headers['content-encoding'] || 'N/A',
        connection: error.response.headers['connection'] || 'N/A'
      });
    } else if (error.request) {
      res.status(502).json({
        status: 502,
        title: null,
        description: null,
        screenshotURL: null,
        contentLength: 'N/A',
        contentType: 'N/A',
        server: 'N/A',
        lastModified: 'N/A',
        httpVersion: 'N/A',
        responseTime: `${responseTime.toFixed(2)} ms`,
        ipAddress: 'N/A',
        redirects: 'N/A',
        cookies: 'N/A',
        cacheControl: 'N/A',
        eTag: 'N/A',
        contentEncoding: 'N/A',
        connection: 'N/A'
      });
    } else {
      res.status(500).json({
        status: 500,
        title: null,
        description: null,
        screenshotURL: null,
        contentLength: 'N/A',
        contentType: 'N/A',
        server: 'N/A',
        lastModified: 'N/A',
        httpVersion: 'N/A',
        responseTime: `${responseTime.toFixed(2)} ms`,
        ipAddress: 'N/A',
        redirects: 'N/A',
        cookies: 'N/A',
        cacheControl: 'N/A',
        eTag: 'N/A',
        contentEncoding: 'N/A',
        connection: 'N/A'
      });
    }
  }
});

//spamshare api
app.get('/share', async (req, res) => {
  const { token, amount = 22200, url, interval = 1500, deleteAfter = 3600 } = req.query;

  if (!token || !url) {
    return res.status(400).json({ error: 'Access token and share URL are required' });
  }

  const shareCount = parseInt(amount);
  const timeInterval = parseInt(interval);
  const deleteAfterSeconds = parseInt(deleteAfter);

  let sharedCount = 0;
  let timer = null;

  try {
    await axios.get(`https://graph.facebook.com/me?access_token=${token}`);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }

  async function sharePost() {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/me/feed?access_token=${token}&fields=id&limit=1&published=0`,
        {
          link: url,
          privacy: { value: 'SELF' },
          no_story: true,
        },
        {
          muteHttpExceptions: true,
          headers: {
            authority: 'graph.facebook.com',
            'cache-control': 'max-age=0',
            'sec-ch-ua-mobile': '?0',
            'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36',
          },
          method: 'post',
        }
      );

      sharedCount++;
      const postId = response?.data?.id;

      console.log(`Post shared: ${sharedCount}`);
      console.log(`Post ID: ${postId || 'Unknown'}`);

      if (sharedCount === shareCount) {
        clearInterval(timer);
        console.log('Finished sharing posts.');

        if (postId) {
          setTimeout(() => {
            deletePost(postId);
          }, deleteAfterSeconds * 1000);
        }
      }
    } catch (error) {
      if (error.response && error.response.data) {
        console.error('Failed to share post:', error.response.data);
      } else {
        console.error('Failed to share post:', error.message);
      }
      clearInterval(timer);
    }
  }

  async function deletePost(postId) {
    try {
      await axios.delete(`https://graph.facebook.com/${postId}?access_token=${token}`);
      console.log(`Post deleted: ${postId}`);
    } catch (error) {
      if (error.response && error.response.data) {
        console.error('Failed to delete post:', error.response.data);
      } else {
        console.error('Failed to delete post:', error.message);
      }
    }
  }

  timer = setInterval(sharePost, timeInterval);

  setTimeout(() => {
    clearInterval(timer);
    console.log('Loop stopped.');
  }, shareCount * timeInterval);

  res.json({ message: 'Sharing process started' });
});

// NGL endpoint
app.get('/ngl', async (req, res) => {
  const { username, message, deviceId, amount } = req.query;

  if (!username || !message || !amount) {
    return res.status(400).json({ error: "Username, message, and amount are required" });
  }

  const url = 'https://ngl.link/api/submit';
  const payload = { username, question: message, deviceId };
  const headers = { 'Content-Type': 'application/json' };

  try {
    for (let i = 0; i < parseInt(amount); i++) {
      const response = await axios.post(url, payload, { headers });
      console.log(`Message ${i + 1} sent`);
    }

    res.json({ 
      message: "Messages sent",
      developedBy: "Joshua Apostol"
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(error.response.status || 500).json({ error: "An error occurred while sending the messages" });
  }
});
// Quote endpoint
app.get('/quote', async (req, res) => {
  try {
    const response = await axios.get('https://quotes.toscrape.com');
    const html = response.data;
    const $ = cheerio.load(html);
    const quotes = [];

    $('.quote').each((index, element) => {
      const quoteText = $(element).find('.text').text();
      const quoteAuthor = $(element).find('.author').text();
      quotes.push({ text: quoteText, author: quoteAuthor });
    });

    const randomIndex = Math.floor(Math.random() * quotes.length);
    res.json(quotes[randomIndex]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the quote');
  }
});

// Joke endpoint
app.get('/joke', async (req, res) => {
  try {
    const response = await axios.get('https://icanhazdadjoke.com/', {
      headers: { 'Accept': 'application/json' }
    });
    res.json({ joke: response.data.joke });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the joke');
  }
});

// Fact endpoint
app.get('/fact', async (req, res) => {
  try {
    const response = await axios.get('https://useless-facts.sameerkumar.website/api');
    res.json({ fact: response.data.data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the fact');
  }
});

// Trivia endpoint
app.get('/trivia', async (req, res) => {
  try {
    const response = await axios.get('https://opentdb.com/api.php?amount=1');
    const trivia = response.data.results[0];
    res.json({
      category: trivia.category,
      question: trivia.question,
      correct_answer: trivia.correct_answer,
      incorrect_answers: trivia.incorrect_answers
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the trivia');
  }
});

// EduTrivia endpoint
app.get('/eduTrivia', async (req, res) => {
  try {
    const response = await axios.get('https://opentdb.com/api.php?amount=1&category=17');
    const trivia = response.data.results[0];
    res.json({
      category: trivia.category,
      question: trivia.question,
      correct_answer: trivia.correct_answer,
      incorrect_answers: trivia.incorrect_answers
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the trivia');
  }
});

// Wikipedia endpoint
app.get('/wikipedia', async (req, res) => {
  const searchQuery = req.query.search;

  if (!searchQuery) {
    return res.status(400).send('Search query parameter is required');
  }

    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchQuery)}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    const result = {
      title: data.title,
      extract: data.extract,
      page_url: data.content_urls.desktop.page,
    };

    res.json(result);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching information');
  }
});

// Wikipedia Image URL endpoint
app.get('/wikipedia-image-url', async (req, res) => {
  const searchQuery = req.query.search;

  if (!searchQuery) {
    return res.status(400).send('Search query parameter is required');
  }

  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&titles=${encodeURIComponent(searchQuery)}&formatversion=2&pithumbsize=300`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    const page = data.query.pages[0];
    const imageUrl = page.thumbnail ? page.thumbnail.source : null;

    res.json({ imageUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the image');
  }
});

function ps(search) {
    return new Promise(async (resolve, reject) => {
        try {
            const { data, status } = await axios.get(
                `https://play.google.com/store/search?q=${search}&c=apps`,
            );
            const result = [];
            const $ = cheerio.load(data);
            $(
                ".ULeU3b > .VfPpkd-WsjYwc.VfPpkd-WsjYwc-OWXEXe-INsAgc.KC1dQ.Usd1Ac.AaN0Dd.Y8RQXd > .VfPpkd-aGsRMb > .VfPpkd-EScbFb-JIbuQc.TAQqTe > a",
            ).each((i, u) => {
                const linkk = $(u).attr("href");
                const names = $(u)
                    .find(".j2FCNc > .cXFu1 > .ubGTjb > .DdYX5")
                    .text();
                const developer = $(u)
                    .find(".j2FCNc > .cXFu1 > .ubGTjb > .wMUdtb")
                    .text();
                const img = $(u).find(".j2FCNc > img").attr("src");
                const rate = $(u)
                    .find(".j2FCNc > .cXFu1 > .ubGTjb > div")
                    .attr("aria-label");
                const rate2 = $(u)
                    .find(".j2FCNc > .cXFu1 > .ubGTjb > div > span.w2kbF")
                    .text();
                const link = `https://play.google.com${linkk}`;

                result.push({
                    link: link,
                    name: names ? names : "No name",
                    developer: developer ? developer : "No Developer",
                    image: img ? img : "https://i.ibb.co/G7CrCwN/404.png",
                    rate: rate ? rate : "No Rate",
                    rate2: rate2 ? rate2 : "No Rate",
                });
            });
            if (result.every((x) => x === undefined))
                return resolve({
                    message: "no result found",
                });
            resolve(result);
        } catch (err) {
            resolve({
                message: "no result found",
            });
        }
    });
}

app.get("/search", async (req, res) => {
    const searchQuery = req.query.q;
    if (!searchQuery) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
    }

    const results = await ps(searchQuery);
    res.json(results);
});

// Pornhub random video endpoint
app.get('/pornhub', async (req, res) => {
  try {
    const response = await axios.get('https://www.pornhub.com');
    const html = response.data;
    const $ = cheerio.load(html);

    const videos = [];
    $('li.videoBox a').each((i, element) => {
      const title = $(element).attr('title');
      const link = `https://www.pornhub.com${$(element).attr('href')}`;
      videos.push({ title, link });
    });

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    res.json(randomVideo);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the video');
  }
});

// Pornhub search videos endpoint
app.get('/pornhubsearch', async (req, res) => {
  const searchQuery = req.query.search;

  if (!searchQuery) {
    return res.status(400).send('Search query parameter is required');
  }

  const url = `https://www.pornhub.com/video/search?search=${encodeURIComponent(searchQuery)}`;

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const videos = [];
    $('li.videoBox').each((i, element) => {
      const title = $(element).find('span.title a').attr('title');
      const link = `https://www.pornhub.com${$(element).find('span.title a').attr('href')}`;
      const thumbnail = $(element).find('img').attr('data-thumb_url') || $(element).find('img').attr('src');
      videos.push({ title, link, thumbnail });
    });

    res.json({ videos });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the videos');
  }
});

// Pornhub download links endpoint
app.get('/pornhubdownload', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).send('Video URL query parameter is required');
  }

  try {
    const response = await axios.get(videoUrl);
    const html = response.data;
    const $ = cheerio.load(html);

    const scripts = $('script').toArray();
    let videoLinks = [];

    for (let script of scripts) {
      const scriptContent = $(script).html();
      if (scriptContent && scriptContent.includes('flashvars_')) {
        const flashvars = JSON.parse(scriptContent.match(/flashvars_\d+\s*=\s*(\{.*?\});/)[1]);
        const mediaDefinitions = flashvars.mediaDefinitions;

        mediaDefinitions.forEach(def => {
          if (def.quality && def.videoUrl) {
            videoLinks.push({
              quality: def.quality,
              url: def.videoUrl
            });
          }
        });

        break;
      }
    }

    res.json({ videoLinks });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the video download links');
  }
});

// Xvideos random video endpoint
app.get('/xvideos', async (req, res) => {
  try {
    const response = await axios.get('https://www.xvideos.com');
    const html = response.data;
    const $ = cheerio.load(html);

    const videos = [];
    $('div.thumb a').each((i, element) => {
      const title = $(element).attr('title');
      const link = `https://www.xvideos.com${$(element).attr('href')}`;
      videos.push({ title, link });
    });

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    res.json(randomVideo);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the video');
  }
});

// Xvideos search videos endpoint
app.get('/xvideosearch', async (req, res) => {
  const searchQuery = req.query.search;

  if (!searchQuery) {
    return res.status(400).send('Search query parameter is required');
  }

  const url = `https://www.xvideos.com/?k=${encodeURIComponent(searchQuery)}`;

  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    const videos = [];
    $('div.thumb-block').each((i, element) => {
      const title = $(element).find('p').text().trim();
      const link = $(element).find('a').attr('href');
      const thumbnail = $(element).find('img').attr('data-src');
      videos.push({ title, link, thumbnail });
    });

    res.json({ videos });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the videos');
  }
});

// Waifu endpoint
app.get('/waifu', async (req, res) => {
  const searchQuery = req.query.search;

  if (!searchQuery) {
    return res.status(400).send('Search query parameter is required');
  }

  const url = `https://api.waifu.im/search?q=${encodeURIComponent(searchQuery)}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    res.set('Access-Control-Allow-Origin', '*');

    res.json({ 
      data,
      message: "Developed by Joshua Apostol"
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the data');
  }
});

//chords
app.get('/search/chords', async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).send('Query parameter is required');
  }

  const apiUrl = `https://markdevs-api.onrender.com/search/chords?q=${encodeURIComponent(query)}`;

  try {
    const { data } = await axios.get(apiUrl);
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching chords data');
  }
});

//county api
app.get('/country', async (req, res) => {
  const countryCode = req.query.code;

  if (!countryCode) {
    return res.status(400).send('Country code parameter is required');
  }

  try {
    const url = `https://restcountries.com/v3.1/alpha/${countryCode}`;
    const response = await axios.get(url);

    if (response.data && response.data.length > 0) {
      const countryData = response.data[0];
      res.json(countryData);
    } else {
      res.status(404).send('dili nako makita lugar bay');
    }
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching country information');
  }
});

//token getter
app.get('/token', async (req, res) => {
  const { username, pass } = req.query;

  if (!username || !pass) {
    return res.status(400).send('Username and password query parameters are required');
  }

  try {
    const token = await getEAAAAU(username, pass);
    res.json({ token });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while fetching the token');
  }
});

async function getEAAAAU(username, pass) {
  const url = `https://b-api.facebook.com/method/auth.login?email=${encodeURIComponent(username)}&password=${encodeURIComponent(pass)}&format=json&generate_session_cookies=1&generate_machine_id=1&generate_analytics_claim=1&locale=en_US&client_country_code=US&credentials_type=device_based_login_password&fb_api_caller_class=com.facebook.account.login.protocol.Fb4aAuthHandler&fb_api_req_friendly_name=authenticate&api_key=882a8490361da98702bf97a021ddc14d&access_token=350685531728%7C62f8ce9f74b12f84c123cc23437a4a32`;
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 4.1.2; GT-I8552 Build/JZO54K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3071.125 Mobile Safari/537.36'
      }
    });
    const data = response.data;
    if (data.access_token) {
      return data.access_token;
    } else {
      return `ERROR: ${data.error_msg}`;
    }
  } catch (error) {
    throw error;
  }
}

//blackbox
app.get('/blackbox', async (req, res) => {
  const { chat } = req.query;

  if (!chat) {
    return res.status(400).send('Chat query parameter is required');
  }

  const url = `https://openapi-idk8.onrender.com/blackbox?chat=${encodeURIComponent(chat)}`;

  try {
    const response = await axios.get(url);
    const data = response.data;
    if (data && typeof data === 'object') {
      data.author = 'NashBot';
    }
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred while processing the request');
  }
});

//gemini
const apiKey = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

app.get('/gemini', async (req, res) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = req.query.prompt;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt query parameter is required' });
    }

    const result = await model.generateContent(prompt);
    const response = result.response;

    res.json({ 
      author: "NashBot",
      response: response.text() 
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: 'An error occurred while generating content' });
  }
});
//merriam webster
app.get('/merriam-webster/definition', async (req, res) => {
  const word = req.query.word;

  if (!word) {
    return res.status(400).json({ error: 'Word parameter is required' });
  }

  try {
    const url = `https://www.merriam-webster.com/dictionary/${word}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    const definitions = [];
    $('.dtText').each((index, element) => {
      definitions.push($(element).text().trim());
    });

    res.json({ word, definitions });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while fetching data' });
  }
});

//pinterest
app.get('/pin', async (req, res) => {
  const { title, count } = req.query;

  if (!title || !count) {
    return res.status(400).json({ error: 'Title and count are required' });
  }

  const url = `https://gpt4withcustommodel.onrender.com/api/pin?title=${encodeURIComponent(title)}&count=${count}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    res.json({
      count: data.count,
      developedBy: 'NashBot',
      images: data.data,
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(error.response?.status || 500).json({ error: 'An error occurred while sending the request' });
  }
});

app.get('/advice', async (req, res) => {
  try {
    const response = await axios.get('https://api.adviceslip.com/advice');

    if (response.status === 200 && response.data && response.data.slip) {
      res.json(response.data.slip);
    } else {
      res.status(500).json({ error: 'Failed to fetch advice' });
    }
  } catch (error) {
    console.error('Error fetching advice:', error);
    res.status(500).json({ error: 'Failed to fetch advice' });
  }
});

app.get('/scrape', async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL query parameter is required' });
  }

  try {
    const response = await axios.get(url);
    const headers = response.headers;
    const $ = cheerio.load(response.data);

    const title = $('title').text();

    res.json({ headers, title });
  } catch (error) {
    res.status(500).json({ error: `Error fetching data from ${url}: ${error.message}` });
  }
});

//gore
function gore() {
    return new Promise((resolve, reject) => {
        const page = Math.floor(Math.random() * 100);
        axios.get('https://seegore.com/gore/page/' + page)
            .then((res) => {
                const $ = cheerio.load(res.data);
                const link = [];
                $('ul > li > article').each(function(a, b) {
                    link.push({
                        title: $(b).find('div.content > header > h2').text(),
                        link: $(b).find('div.post-thumbnail > a').attr('href'),
                        thumb: $(b).find('div.post-thumbnail > a > div > img').attr('src'),
                        view: $(b).find('div.post-thumbnail > div.post-meta.bb-post-meta.post-meta-bg > span.post-meta-item.post-views').text(),
                        vote: $(b).find('div.post-thumbnail > div.post-meta.bb-post-meta.post-meta-bg > span.post-meta-item.post-votes').text(),
                        tag: $(b).find('div.content > header > div > div.bb-cat-links').text(),
                        comment: $(b).find('div.content > header > div > div.post-meta.bb-post-meta > a').text()
                    });
                });
                const random = link[Math.floor(Math.random() * link.length)];
                axios.get(random.link)
                    .then((resu) => {
                        const $$ = cheerio.load(resu.data);
                        const result = {};
                        result.title = random.title;
                        result.source = random.link;
                        result.thumb = random.thumb;
                        result.tag = $$('div.site-main > div > header > div > div > p').text();
                        result.upload = $$('div.site-main').find('span.auth-posted-on > time:nth-child(2)').text();
                        result.author = $$('div.site-main').find('span.auth-name.mf-hide > a').text();
                        result.comment = random.comment;
                        result.vote = random.vote;
                        result.view = $$('div.site-main').find('span.post-meta-item.post-views.s-post-views.size-lg > span.count').text();
                        result.video1 = $$('div.site-main').find('video > source').attr('src');
                        result.video2 = $$('div.site-main').find('video > a').attr('href');
                        result.author = 'NashBot';
                        resolve(result);
                    })
                    .catch(err => reject(err));
            })
            .catch(err => reject(err));
    });
}

app.get('/gore', (req, res) => {
    gore()
        .then(data => res.json(data))
        .catch(err => res.status(500).json({ error: err.message }));
});

//emojimix
app.get('/emojimix', async (req, res) => {
  const x = req.query.one;
  const y = req.query.two;

  if (!x || !y) {
    return res.status(400).json({ error: 'Missing query parameters' });
  }

  const url = `https://tenor.googleapis.com/v2/featured?key=AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ&contentfilter=high&media_filter=png_transparent&component=proactive&collection=emoji_kitchen_v5&q=${x}_${y}`;

  try {
    const response = await axios.get(url);
    const data = response.data;

    if (data.error) {
      res.status(response.status).json(data);
    } else if (data.locale === '') {
      res.status(404).json(data);
    } else {
      res.status(200).json(data);
    }
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

//autocomment
const geepi = (token) => {
  return {
    sendComment: async (postId, comment) => {
      try {
        const response = await axios.post(`https://graph.facebook.com/${postId}/comments`, {
          message: comment,
        }, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        return response.data;
      } catch (error) {
        return null;
      }
    }
  };
};

app.get('/auto-comment', async (req, res) => {
  const token = req.query.token;
  const comment = req.query.comment;
  const postId = req.query.postId;
  const count = req.query.count;

  console.log(token, comment, postId, count);

  if (!token || !comment || !postId) {
    console.log("Error: Missing required parameters");
    return res.status(403).json({ status: 'error', error_msg: 'Invalid parameter value' });
  }

  const fb = geepi(token);
  let i = 0;

  while (i < parseInt(count)) {
    const graph = await fb.sendComment(postId, comment);
    if (!graph) {
      console.log("Error: Failed to send comment");
      return res.status(403).json({ status: 'error' });
    }
    i++;
  }

  return res.status(200).json({ status: 'success', total: i });
});

//hentai gif
app.get('/gif', (req, res) => {
  res.sendFile(path.join(__dirname, 'gif.html'));
});

app.post('/upload-gif', (req, res) => {
  const { gifLink } = req.body;

  fs.readFile('gifs.json', (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Error reading file' });
    }

    const json = JSON.parse(data);
    json.hentaiGifs.push(gifLink);

    fs.writeFile('gifs.json', JSON.stringify(json, null, 2), (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Error writing file' });
      }

      res.status(200).json({ success: true });
    });
  });
});

app.get('/hentai-gif', (req, res) => {
  fs.readFile('gifs.json', (err, data) => {
    if (err) {
      return res.status(500).json({ message: 'Error reading file' });
    }

    const { hentaiGifs } = JSON.parse(data);
    const randomIndex = Math.floor(Math.random() * hentaiGifs.length);
    const randomGifUrl = hentaiGifs[randomIndex];

    res.status(200).json({ gifUrl: randomGifUrl });
  });
});

//Anime search
app.get('/anime', async (req, res) => {
    const { q } = req.query;
    const apiUrl = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}`;

    try {
        const response = await axios.get(apiUrl);
        const data = response.data;

        const formattedData = data.data.map(anime => ({
            id: anime.mal_id,
            title: anime.title,
            synopsis: anime.synopsis,
            episodes: anime.episodes,
            score: anime.score,
            image_url: anime.images.jpg.image_url,
            url: anime.url
        }));

        res.json({
            status: true,
          author: 'NashBot',
            result: formattedData
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            message: 'An error occurred while processing your request.',
        });
    }
});

//manga
app.get('/manga-search', async (req, res) => {
  try {
    const { title } = req.query;
    if (!title) {
      return res.status(400).json({ error: 'The title query parameter is required.' });
    }

    const response = await axios.get(`https://api.mangadex.org/manga?title=${encodeURIComponent(title)}`);
    const mangaData = response.data.data;
    const manga = mangaData.map(m => ({
      id: m.id,
      title: m.attributes.title.en,
      description: m.attributes.description.en,
      coverUrl: m.attributes.coverArt,
      status: m.attributes.status,
      createdAt: m.attributes.createdAt,
      updatedAt: m.attributes.updatedAt
    }));
    res.json(manga);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

//quotes v2
const scrapeQuotes = async () => {
    try {
        const url = 'https://quotes.toscrape.com';
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const quotes = [];
        $('.quote').each((index, element) => {
            const text = $(element).find('.text').text();
            const author = $(element).find('.author').text();
            quotes.push({ text, author });
        });

        return quotes;
    } catch (error) {
        throw new Error('Error scraping quotes: ' + error.message);
    }
};

app.get('/quotes/v2', async (req, res) => {
    try {
        const quotes = await scrapeQuotes();
        res.json({
            status: 'success',
            quotes
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

//pinterest
app.get('/pinterest', async (req, res) => {
  const { search } = req.query;

  if (!search) {
    return res.status(400).json({ error: 'Search query parameter is required' });
  }

  try {
    const response = await axios.get(`https://hiroshi-rest-api.replit.app/search/pinterest?search=${encodeURIComponent(search)}`);
    const imageUrls = response.data;

    const result = {
      count: imageUrls.length,
      data: imageUrls
    };

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching data from the external API' });
  }
});

//anime hentai search
app.get('/hentai', async (req, res) => {
  const { search, amount } = req.query;

  if (!search || !amount) {
    return res.status(400).json({ error: 'Search query and amount are required' });
  }

  const numResults = parseInt(amount, 10);

  try {
    const response = await axios.get('https://gelbooru.com/index.php', {
      params: {
        page: 'dapi',
        s: 'post',
        q: 'index',
        json: 1,
        tags: search,
        limit: numResults
      }
    });

    const results = response.data.post.map(post => post.file_url);
    res.json({
      count: results.length,
      data: results
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching data', error: error.message });
  }
});

//random-video-hent
app.get('/random/hentai/video/gif', async (req, res) => {
  try {
    const page = Math.floor(Math.random() * 100) + 1;

    const response = await axios.get('https://e621.net/posts.json', {
      params: {
        tags: 'video rating:explicit',
        limit: 100,
        page: page
      },
      headers: {
        'User-Agent': 'naahbot/1.0 (by joshuaApostol on e621)'
      }
    });

    const posts = response.data.posts;
    if (posts.length > 0) {
      const randomIndex = Math.floor(Math.random() * posts.length);
      const randomPost = posts[randomIndex];
      const videoUrl = randomPost.file.url;

      res.json({
        videoUrl: videoUrl
      });
    } else {
      res.status(404).json({ message: 'No videos found on this page' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching data', error: error.message });
  }
});
//image-emi
app.get('/image-emi', async (req, res) => {
    const { prompt } = req.query;

    if (!prompt) {
        return res.status(400).json({ error: 'Usage: /image-emi?prompt=dog' });
    }

    try {
        const response = await axios.get(`https://hiroshi-rest-api.replit.app/image/emi`, {
            params: { prompt },
            responseType: 'arraybuffer'
        });

        res.set('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

//bible random
app.get('/random-bible-verse', async (req, res) => {
    try {
        const response = await axios.get(`https://labs.bible.org/api/?passage=random`);

        res.json({ verse: response.data });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

//font converter
app.get('/convert-text', async (req, res) => {
    const { text } = req.query;

    if (!text) {
        return res.status(400).json({
            error: 'Please provide a text parameter using the format: /convert-text?text=<yourText>. For example, /convert-text?text=hello'
        });
    }

    try {
        const response = await axios.get('http://qaz.wtf/u/convert.cgi', {
            params: { text }
        });

        const $ = cheerio.load(response.data);
        const fontData = $('body').text();

        res.json({ fontData });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while processing your request. Please try again later.' });
    }
});

//dailymotion-video
app.get('/dailymotion-video', async (req, res) => {
  try {
    const { query, limit = 1000 } = req.query;

    if (!query) {
      return res.status(400).send('Missing query parameter');
    }

    const maxResults = parseInt(limit, 10);
    let allVideos = [];
    let currentPage = 1;
    const perPage = 10;

    const fetchPage = async (page) => {
      try {
        const response = await axios.get('https://api.dailymotion.com/videos', {
          params: {
            fields: 'id,title,url',
            search: query,
            limit: perPage,
            page: page
          }
        });
        return response.data.list;
      } catch (error) {
        console.error('Error fetching Dailymotion page:', error.message);
        throw error;
      }
    };

    while (allVideos.length < maxResults) {
      const videos = await fetchPage(currentPage);

      if (videos.length > 0) {
        allVideos = allVideos.concat(videos);
        currentPage++;
      } else {
        break;
      }

      if (allVideos.length >= maxResults) {
        break;
      }
    }

    const processedVideos = allVideos.map(video => ({
      id: video.id,
      title: video.title,
      url: video.url
    }));

    res.json(processedVideos.slice(0, maxResults));
  } catch (error) {
    console.error('Error fetching Dailymotion data:', error.message);
    res.status(500).send('Error fetching Dailymotion data');
  }
});

//random-meme
app.get('/random-meme', async (req, res) => {
  try {
    const response = await axios.get('https://api.imgflip.com/get_memes');
    const memes = response.data.data.memes;

    const randomIndex = Math.floor(Math.random() * memes.length);
    const randomMeme = memes[randomIndex];

    res.json({
      id: randomMeme.id,
      name: randomMeme.name,
      url: randomMeme.url
    });
  } catch (error) {
    res.status(500).send('Error fetching meme data');
  }
});

//cat fact
app.get('/cat-fact', async (req, res) => {
  try {
    const response = await axios.get('https://meowfacts.herokuapp.com/');
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching cat fact');
  }
});

//number fact
app.get('/number-fact', async (req, res) => {
  try {
    const response = await axios.get('http://numbersapi.com/random');
    res.json({ fact: response.data });
  } catch (error) {
    res.status(500).send('Error fetching number fact');
  }
});

//dog fact
app.get('/dog-fact', async (req, res) => {
  try {
    const response = await axios.get('https://dog-api.kinduff.com/api/facts');
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching dog fact');
  }
});

//random dog Emage
app.get('/random-dog-image', async (req, res) => {
  try {
    const response = await axios.get('https://random.dog/woof.json');
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching random dog image');
  }
});

//dictionary
app.get('/dictionary', async (req, res) => {
  const word = req.query.word || 'hello';
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching dictionary data');
  }
});

//coctail
app.get('/cocktail', async (req, res) => {
  try {
    const response = await axios.get('https://www.thecocktaildb.com/api/json/v1/1/random.php');
    res.json(response.data);
  } catch (error) {
    res.status(500).send('Error fetching cocktail');
  }
});

//cat image
app.get('/cat-image', async (req, res) => {
  try {
    const response = await axios.get('https://api.thecatapi.com/v1/images/search');
    res.json(response.data[0]);
  } catch (error) {
    res.status(500).send('Error fetching cat image');
  }
});

//Genderize
app.get('/gender', async (req, res) => {
    const { name } = req.query;

    if (!name) {
        return res.status(400).json({
            error: 'Please provide a name query parameter using the format: /gender?name=<name>. For example, /gender?name=Joshua'
        });
    }

    try {
        const response = await axios.get(`https://api.genderize.io`, {
            params: { name }
        });

        res.json({
            status: response.data.gender ? 'success' : 'not found',
            name,
            gender: response.data.gender,
            probability: response.data.probability,
            count: response.data.count
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching the gender. Please try again later.' });
    }
});

//random ngl spam
const loveLifeMessages = [
  "Love is not about how much you say 'I love you', but how much you prove that it's true.",
  "The best thing to hold onto in life is each other.",
  "Love recognizes no barriers. It jumps hurdles, leaps fences, penetrates walls to arrive at its destination full of hope.",
  "Love isn't something you find. Love is something that finds you.",
  "The best love is the kind that awakens the soul.",
  "You are my today and all of my tomorrows.",
  "I love you more than I have ever found a way to say to you.",
  "You make me want to be a better man.",
  "To love and be loved is to feel the sun from both sides.",
  "I would rather spend one lifetime with you, than face all the ages of this world alone.",
  "Love is composed of a single soul inhabiting two bodies.",
  "We loved with a love that was more than love.",
  "You are the source of my joy, the center of my world, and the whole of my heart.",
  "I look at you and see the rest of my life in front of my eyes.",
  "I love you not only for what you are, but for what I am when I am with you.",
  "My love for you is a journey; starting at forever, and ending at never.",
  "You have bewitched me, body and soul, and I love, I love, I love you.",
  "There is no charm equal to tenderness of heart.",
  "You are my heart, my life, my one and only thought.",
  "If I know what love is, it is because of you."
];

const tagalogInsults = [
  "Tangina mo!",
  "Ulol ka!",
  "Bobo mo!",
  "Tarantado ka!",
  "Leche ka!",
  "Peste ka!",
  "Tanga ka!",
  "Hudas ka!",
  "Walang hiya ka!",
  "Lintik ka!",
  "Gago ka!",
  "Bwesit ka!",
  "Gunggong!",
  "Pakyu ka!",
  "Salot ka!",
  "Animal ka!",
  "Hangal ka!",
  "Sira ulo ka!",
  "Hayop ka!",
  "Luko-luko ka!"
];

const confessionMessages = [
  "I've had a crush on you for the longest time.",
  "I miss you more than you could possibly imagine.",
  "I still think about the time we spent together.",
  "I've never felt this way about anyone before.",
  "You make my heart skip a beat.",
  "I wish I could tell you how I really feel.",
  "I've been keeping a secret from you.",
  "I love the way you smile.",
  "You are always on my mind.",
  "I've always admired your kindness.",
  "You inspire me to be a better person.",
  "I've never stopped loving you.",
  "Every moment with you is a treasure.",
  "You are the first thing I think about in the morning.",
  "I want to be with you more than anything.",
  "I've been hiding my feelings for you.",
  "You are the light of my life.",
  "My heart belongs to you.",
  "I can't imagine my life without you.",
  "You mean everything to me."
];

function getRandomMessage(category) {
  let messages;
  if (category === 'love') {
    messages = loveLifeMessages;
  } else if (category === 'insult') {
    messages = tagalogInsults;
  } else if (category === 'confess') {
    messages = confessionMessages;
  } else {
    messages = loveLifeMessages.concat(tagalogInsults).concat(confessionMessages);
  }
  return messages[Math.floor(Math.random() * messages.length)];
}

function getRandomDeviceId() {
  return 'device-' + Math.random().toString(36).substr(2, 9);
}

//ngl
app.get('/ngl', async (req, res) => {
  const { username, category, amount } = req.query;
  let { deviceId } = req.query;

  if (!username || !amount) {
    return res.status(400).json({ error: "Username and amount are required" });
  }

  if (!deviceId) {
    deviceId = getRandomDeviceId();
  }

  const url = 'https://ngl.link/api/submit';
  const headers = { 'Content-Type': 'application/json' };

  const numMessages = parseInt(amount, 10);
  if (isNaN(numMessages) || numMessages <= 0) {
    return res.status(400).json({ error: 'Invalid amount parameter.' });
  }

  try {
    for (let i = 0; i < numMessages; i++) {
      const message = getRandomMessage(category);
      const payload = { username, question: message, deviceId };

      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await axios.post(url, payload, { headers });

      console.log(`Message ${i + 1} sent: ${message}`);
      console.log(`Response status: ${response.status}`);
      console.log(`Response data: ${JSON.stringify(response.data)}`);
    }

    res.json({
      message: "Messages sent",
      developedBy: "Joshua Apostol"
    });
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    res.status(error.response ? error.response.status : 500).json({ error: "An error occurred while sending the messages" });
  }
});

//ss-site
const API_KEY = '254572';

app.get('/screenshot', (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const screenshotURL = `https://api.screenshotmachine.com?key=${API_KEY}&url=${encodeURIComponent(url)}&dimension=1024x768`;

  res.json({ screenshotURL });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});