// Synthetic devices for headless tests: canvas camera + oscillator microphone.
(() => {
  function fakeVideo() {
    const c = Object.assign(document.createElement("canvas"), { width: 640, height: 360 });
    const g = c.getContext("2d");
    let t = 0;
    setInterval(() => {
      t++;
      g.fillStyle = "#3a5a8a"; g.fillRect(0, 0, 640, 360);
      g.fillStyle = "#f2c14e"; g.beginPath(); g.arc(320 + 120 * Math.sin(t / 15), 180, 60, 0, 7); g.fill();
      g.fillStyle = "#fff"; g.font = "28px sans-serif"; g.fillText("Fake camera", 24, 44);
    }, 50);
    const track = c.captureStream(20).getVideoTracks()[0];
    track.getSettings = () => ({ deviceId: "fake-cam" });
    return track;
  }
  let ctx;
  function fakeAudio() {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator(); const gain = ctx.createGain(); gain.gain.value = 0.3;
    const dest = ctx.createMediaStreamDestination();
    osc.connect(gain).connect(dest); osc.start();
    const track = dest.stream.getAudioTracks()[0];
    track.getSettings = () => ({ deviceId: "fake-mic" });
    return track;
  }
  navigator.mediaDevices.getUserMedia = async (c) => {
    const tracks = [];
    if (c.audio) tracks.push(fakeAudio());
    if (c.video) tracks.push(fakeVideo());
    return new MediaStream(tracks);
  };
  navigator.mediaDevices.getDisplayMedia = async () => new MediaStream([fakeVideo()]);
  navigator.mediaDevices.enumerateDevices = async () => [
    { kind: "audioinput", deviceId: "fake-mic", label: "Fake Microphone", groupId: "1" },
    { kind: "videoinput", deviceId: "fake-cam", label: "Fake Camera", groupId: "2" },
    { kind: "audiooutput", deviceId: "fake-spk", label: "Fake Speakers", groupId: "3" },
  ];
})();
