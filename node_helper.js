const NodeHelper = require("node_helper");
const { Configuration, OpenAIApi } = require("openai");
// This requires ws installed using 'npm i ws'.
const WebSocket = require("ws");

var socket = null;
let stt = "";

module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node helper for: " + this.name);
    this.configuration = new Configuration({
      apiKey: ""
    });
    this.openai = new OpenAIApi(this.configuration);
    this.DG_ENDPOINT = "wss://api.deepgram.com/v1/listen";
    //console.log(this.openai);
  },

  // Send a message to the chatGPT API and receive a response
  getResponse: function (prompt) {
    console.log("getREsponse call to GPT-3 ");
    return new Promise(async (resolve, reject) => {
      try {
        const response = await this.openai.createCompletion({
          model: "text-davinci-003",
          prompt: prompt,
          max_tokens: 256,
          temperature: 0.7
        });
        // console.log("Received response from API: ", response);
        console.log("GPT-3 API Status: ", response?.status);
        resolve(response);
      } catch (error) {
        console.log("Error in getResponse: ", error);
        reject(error);
      }
    });
  },

  // Handle socket notifications
  socketNotificationReceived: function (notification, payload) {
    if (notification === "OPENAI_REQUEST") {
      console.log("calling openai w payload", payload);
      const prompt = payload.prompt;

      this.getResponse(prompt)
        .then(
          function (response) {
            const message = response.data.choices[0].text;
            this.sendSocketNotification("OPENAI_RESPONSE", {
              message: message
            });
          }.bind(this)
        )
        .catch(function (error) {
          console.error(error);
        });
    }
    if (notification === "SPEECH_TEXT") {
      // Connect to the streaming endpoint.

      console.log("Establishing Deepgram connection.", socket?.readyState);

      if (socket?.readyState !== 1) {
        // Configure the websocket connection.
        socket = new WebSocket("wss://api.deepgram.com/v1/listen", {
          // Replace with your Deepgram project's API Key.
          headers: {
            Authorization: "Token YOUR_API_KEY"
          }
        });

        const heartbeat = (ws, delay) => {
          clearTimeout(ws.pingTimeout);

          socket.pingTimeout = setTimeout(() => {
            socket.terminate();
          }, delay);
        };

        const ping = () => {
          heartbeat(socket, 1000);
        };

        socket.on("ping", ping).on("close", () => {
          clearTimeout(socket.pingTimeout);
        });
      }

      socket.onopen = (m) => {
        console.log("Socket opened!");
        // Grab audio
        var contents = payload;
        // Send the audio to the Deepgram API all at once (works if audio is relatively short).
        socket.send(contents);
        // Send the audio to the Deepgram API in chunks of 1000 bytes.
        let chunk_size = 1000;
        for (let i = 0; i < contents.length; i += chunk_size) {
          let slice = contents.slice(i, i + chunk_size);
          socket.send(slice);
        }
      };

      socket.onmessage = (m) => {
        m = JSON.parse(m.data);
        // Log the received message.
        //   console.log(m);

        // Log just the words from the received message.
        if (m.hasOwnProperty("channel")) {
          let words = m?.channel?.alternatives[0]?.words;
          words.forEach((word, index) => {
            index !== 0 ? (stt += word.word) : (stt += " " + word.word);
          });

          console.log(stt);
        }
      };

      if (typeof stt !== "undefined" && stt.length > 0) {
        this.sendSocketNotification("OPENAI_REQUEST", {
          prompt: stt
        });
      }
    }
  }
});
