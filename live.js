// আপনার Firebase প্রজেক্টের কনফিগারেশন এখানে পেস্ট করুন
const firebaseConfig = {
  apiKey: "AIzaSyBDEziwwwjG40fVpcjOsRnBuxM_DpLeFsU",
  authDomain: "zenco-ae573.firebaseapp.com",
  databaseURL: "https://zenco-ae573-default-rtdb.firebaseio.com",
  projectId: "zenco-ae573",
  storageBucket: "zenco-ae573.firebasestorage.app",
  messagingSenderId: "712654510120",
  appId: "1:712654510120:web:abfb357c295366b1883d1d",
  measurementId: "G-QFV56QFZPR"
};

// Firebase শুরু করুন
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// গ্লোবাল ভ্যারিয়েবল
let pc; // RTCPeerConnection

// DOM এলিমেন্টস
const playBtn = document.getElementById('playBtn');
const statusDiv = document.getElementById('status');
const remoteAudio = document.getElementById('remoteAudio');

// লাইভ স্ট্যাটাস চেক করুন
const callDoc = db.collection('calls').doc('live_session');
callDoc.onSnapshot((snapshot) => {
    const data = snapshot.data();
    if (data?.isLive) {
        statusDiv.textContent = 'Status: Live stream is ON';
        playBtn.disabled = false;
    } else {
        statusDiv.textContent = 'Status: Offline';
        playBtn.disabled = true;
        if (pc) {
            pc.close();
            pc = null;
        }
    }
});

// প্লে বাটনে ক্লিক করলে কানেকশন শুরু হবে
playBtn.addEventListener('click', async () => {
    playBtn.disabled = true;

    // WebRTC কানেকশন সেটআপ
    const servers = {
        iceServers: [
            { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
        ]
    };
    pc = new RTCPeerConnection(servers);

    // রিমোট স্ট্রিম গ্রহণ করুন
    pc.ontrack = (event) => {
        remoteAudio.srcObject = event.streams[0];
    };

    // Firestore থেকে Offer নিন
    const callData = (await callDoc.get()).data();
    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    // Answer তৈরি করুন এবং Firestore-এ সেভ করুন
    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };
    await callDoc.update({ answer });

    // Offer Candidates-এর জন্য শুনুন
    const offerCandidates = callDoc.collection('offerCandidates');
    offerCandidates.onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    // Answer Candidates Firestore-এ যোগ করুন
    const answerCandidates = callDoc.collection('answerCandidates');
    pc.onicecandidate = event => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };
});
