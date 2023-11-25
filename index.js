const { Client } = require("discord.js-selfbot-v13");
const cheerio = require("cheerio");
const axios = require("axios");
const fs = require("fs");

const channelId = "1177099398010900500";
const url = "https://www.allkpop.com/?view=a&feed=a&sort=b";

const client = new Client({
  checkUpdate: false,
});

let articlesGenerated = [];
let articlesFinished;

let alreadySent = [];

let wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

fs.readFile("written.json", (err, data) => {
  if (err) {
    console.log(err);
  } else {
    const json = JSON.parse(data);
    alreadySent = json.written;
  }
});

client.on("ready", async () => {
  await articlesFinished;

  for (const article of articlesGenerated) {
    let originalTitle = article.title;
    console.log(article.title);
    if (alreadySent.includes(article.title)) continue;
    await wait(5000);
    const channel = await client.channels.fetch(channelId);

    //if text is empty add newLine to next text element and remove empty text element
    for (let i = 0; i < article.text.length; i++) {
      if (article.text[i] === "") {
        article.text[i + 1] = "\n" + article.text[i + 1];
        article.text.splice(i, 1);
      }
    }

    //check if title is greater than 100 characters then split 100 characters
    if (article.title.length > 100) {
      article.title = article.title.substring(0, 96) + "...";
    }

    //check if other text elements is greater than 2000 characters then split 2000 characters into first element and rest into second element
    for (let i = 0; i < article.text.length; i++) {
      if (article.text[i].length > 2000) {
        article.text[i + 1] =
          article.text[i].substring(2000) + article.text[i + 1];
        article.text[i] = article.text[i].substring(0, 1999);
      }
    }

    //check if any text element is only \n
    for (let i = 0; i < article.text.length; i++) {
      if (article.text[i] === "\n") {
        article.text[i] =
          "-----------------------------------------------------------------";
      }
    }

    //console.log(article.text);
    const thread = await channel.threads.create({
      name: article.title,
      autoArchiveDuration: 60,
      message: {
        content: article.text[0],
      },
    });

    for (let i = 1; i < article.text.length; i++) {
      await wait(2000);
      thread.send(article.text[i]);
    }

    thread.send(article.userComments);

    alreadySent.push(originalTitle);

    fs.writeFile(
      "written.json",
      JSON.stringify({ written: alreadySent }),
      (err) => {
        if (err) {
          console.log(err);
        } else {
          console.log("Data written successfully");
        }
      }
    );
  }
});

(async function () {
  articlesFinished = new Promise(async (resolve, reject) => {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const articles = $(".more_stories_scr");

    for (const article of articles[0].children) {
      const title = $(article).find(".title").text();

      const url = $(article).find(".h_a_i ").attr("href");
      const articleUrl = `https://www.allkpop.com${url}`;

      try {
        const articleContent = await axios.get(articleUrl);
        const b = cheerio.load(articleContent.data);

        let text = [];
        //get all descendants in article using cheerio
        b(".entry_content")
          .children()
          .each((i, e) => {
            //if image tag, get src
            if (e.name === "figure") {
              //if first child is image tag, get src)
              if (e.children[0].name === "img")
                text.push(
                  "https://www.allkpop.com" + e.children[0].attribs.src
                );

              //if has iframe as child, get src
              if (e.children[0].name === "iframe")
                text.push(e.children[0].attribs.src);

              //if has video as child, get src
            }
            //if p tag, get text
            if (e.name === "p") {
              text.push(b(e).text());
            }
          });

        let userComments = "***Netizen Reactions*** \n\n";
        //get all comments in article using cheerio
        b(".comment").each((i, e) => {
          const comment = b(e).find(".comment-text").text();
          const author = b(e).find(".commenter-name").text();
          const date = b(e).find(".realtime").text();
          const likes = b(e).find(".vote_comment_plus").text();
          const dislikes = b(e).find(".vote_comment_minus").text();

          userComments += `**${author}**: ${comment} \n ${likes} likes and ${dislikes} dislikes \n\n`;
        });

        articlesGenerated.push({
          title,
          text,
          userComments,
        });
      } catch (err) {}
    }

    resolve();
  });
})();

client.login(process.env.auth);
