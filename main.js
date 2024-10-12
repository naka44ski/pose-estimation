const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

let recording = false;
let motionData = [];
let frameCount = 0;

// 現在の手と肘の位置を保持
let currentHand = null;
let currentElbow = null;

// カメラの初期化
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({video: true});
        videoElement.srcObject = stream;
        return new Promise((resolve) => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });
    } catch (error) {
        console.error('カメラの初期化に失敗しました:', error);
    }
}

// Handsソリューションの設定
const hands = new Hands({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});
hands.setOptions({
    maxNumHands: 2, // 複数の手を検出する場合は2に設定
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// Poseソリューションの設定
const pose = new Pose({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

// HandsとPoseの結果ハンドラを設定
hands.onResults(onHandResults);
pose.onResults(onPoseResults);

// カメラの設定と開始
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await hands.send({image: videoElement});
        await pose.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();

// Handsの結果処理
function onHandResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // 手のランドマークが検出されている場合
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        results.multiHandLandmarks.forEach((landmarks, index) => {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
            drawLandmarks(canvasCtx, landmarks, {color: '#FF0000', lineWidth: 1});
        });
        // 最初の手の手首を取得
        const firstHandLandmarks = results.multiHandLandmarks[0];
        if (firstHandLandmarks && firstHandLandmarks.length > 0) {
            const wrist = firstHandLandmarks[0];
            currentHand = {x: wrist.x, y: wrist.y, z: wrist.z};
        } else {
            currentHand = null;
            // console.warn('手の手首ランドマークが見つかりませんでした。');
        }
    } else {
        currentHand = null;
        // console.warn('手が検出されませんでした。');
    }
    canvasCtx.restore();
}

// Poseの結果処理
function onPoseResults(results) {
    canvasCtx.save();
    // 肘のランドマークが検出されている場合
    if (results.poseLandmarks && results.poseLandmarks.length > 0) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00AAFF', lineWidth: 2});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FFAA00', lineWidth: 1});
        // 肘のランドマーク（左肘: 13, 右肘: 14）
        const leftElbow = results.poseLandmarks[13];
        const rightElbow = results.poseLandmarks[14];
        // 右肘が存在すれば右肘を使用、なければ左肘を使用
        if (rightElbow) {
            currentElbow = {x: rightElbow.x, y: rightElbow.y, z: rightElbow.z};
        } else if (leftElbow) {
            currentElbow = {x: leftElbow.x, y: leftElbow.y, z: leftElbow.z};
        } else {
            currentElbow = null;
            // console.warn('肘のランドマークが見つかりませんでした。');
        }
    } else {
        currentElbow = null;
        // console.warn('Poseが検出されませんでした。');
    }
    canvasCtx.restore();
}

// 計測データの収集
function collectData() {
    if (recording && currentHand && currentElbow) {
        motionData.push({
            frame: frameCount,
            hand: {x: currentHand.x, y: currentHand.y, z: currentHand.z},
            elbow: {x: currentElbow.x, y: currentElbow.y, z: currentElbow.z}
        });
        frameCount++;
    }
    requestAnimationFrame(collectData);
}

// グラフの描画
function drawChart() {
    const labels = motionData.map(data => data.frame);
    const handX = motionData.map(data => data.hand.x);
    const handY = motionData.map(data => data.hand.y);
    const elbowX = motionData.map(data => data.elbow.x);
    const elbowY = motionData.map(data => data.elbow.y);

    const ctx = document.getElementById('motionChart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '手 X',
                    data: handX,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    fill: false
                },
                {
                    label: '手 Y',
                    data: handY,
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    fill: false
                },
                {
                    label: '肘 X',
                    data: elbowX,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1,
                    fill: false
                },
                {
                    label: '肘 Y',
                    data: elbowY,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'フレーム数'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '正規化座標'
                    },
                    min: 0,
                    max: 1
                }
            }
        }
    });
}

// ボタンイベントの設定
startButton.addEventListener('click', () => {
    recording = true;
    motionData = [];
    frameCount = 0;
    startButton.disabled = true;
    stopButton.disabled = false;
    collectData();
    console.log('計測を開始しました。');
});

stopButton.addEventListener('click', () => {
    recording = false;
    startButton.disabled = false;
    stopButton.disabled = true;
    drawChart();
    console.log('計測を終了し、グラフを描画しました。');
});

// 初期化処理
initCamera();