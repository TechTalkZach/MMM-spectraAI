let prompt = "Ask a Question";
Module.register("MMM-spectraAI", {
  defaults: {
    OPENAI_API_KEY: "",
    DEEPGRAM_API_KEY: "",
    DG_ENDPOINT: "wss://api.deepgram.com/v1/listen",
    //apiEndpoint: "https://api.openai.com/v1",
    prompt: prompt,
    updateInterval: 10 * 1000 // update every hour
  },

  start: function () {
    console.log("Starting module: " + this.name);
    this.loaded = false;
    this.message = "";
    // this.sendSocketNotification("OPENAI_REQUEST", this.config);

    // Request permission to access the user's microphone
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        console.log({ stream });
        // Create a new MediaRecorder object to capture audio
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: "audio/webm"
        });

        mediaRecorder.start(5000);
        // Start recording when the MediaRecorder is ready
        mediaRecorder.ondataavailable = (event) => {
          // Handle the recorded audio data
          const audioData = event.data;
          //   console.log("Recorded audio data:", audioData);
          this.sendSocketNotification("SPEECH_TEXT", audioData);
        };
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
      });
  },

  getDom: function () {
    let wrapper = document.createElement("div");
    let human_question = document.createElement("h2");
    let chatGPT_answer = document.createElement("h2");

    if (!this.loaded) {
      chatGPT_answer.innerHTML = "Loading...";
      wrapper.appendChild(human_question);
      wrapper.appendChild(chatGPT_answer);
      return wrapper;
    }

    human_question.innerHTML = prompt;
    chatGPT_answer.innerHTML = this.message;
    wrapper.appendChild(human_question);
    wrapper.appendChild(chatGPT_answer);
    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    switch (notification) {
      case "OPENAI_REQUEST":
        this.message = payload.message;
        if (payload.message) {
          console.log(payload.message);
        }
        prompt = payload.prompt;
        this.loaded = true;
        console.log("OPENAI_REQUEST", prompt);
        this.updateDom();
        setTimeout(() => {
          this.sendSocketNotification("OPENAI_REQUEST", {
            prompt
          });
        }, this.config.updateInterval);
        break;
      case "TRANSCRIBED_SPEECH":
        console.log("TRANSCRIBED_SPEECH", payload);
        console.log("test prompt:", prompt);
        break;
      default:
        break;
    }
  }
});
