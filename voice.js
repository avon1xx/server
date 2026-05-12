// ── VOICE INPUT ──
let micRec=null, micOn=false;
function toggleMic() {
  const btn=document.getElementById("mic-btn"), stat=document.getElementById("mic-status");
  if (!("webkitSpeechRecognition" in window)&&!("SpeechRecognition" in window)){
    appendSystem("Voice input not supported. Use Chrome or Edge.");return;
  }
  if (micOn) { micRec?.stop();return; }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  micRec=new SR();micRec.continuous=false;micRec.interimResults=true;micRec.lang="en-US";
  micRec.onstart=()=>{micOn=true;if(btn)btn.classList.add("active");if(stat)stat.classList.add("on");};
  micRec.onresult=e=>{
    const textarea = document.getElementById("prompt-input");
    if (textarea) textarea.value=[...e.results].map(r=>r[0].transcript).join("");
    if (textarea) textarea.dispatchEvent(new Event("input"));
  };
  micRec.onend=()=>{micOn=false;if(btn)btn.classList.remove("active");if(stat)stat.classList.remove("on");const textarea=document.getElementById("prompt-input"); if(textarea && textarea.value.trim()) handleSend();};
  micRec.onerror=()=>{micOn=false;if(btn)btn.classList.remove("active");if(stat)stat.classList.remove("on");};
  micRec.start();
}