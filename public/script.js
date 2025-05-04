(async () => {
  const isResult = location.pathname.includes('result.html');

  if (!isResult) {
    const faceDetector = ('FaceDetector' in window) ? new FaceDetector({ fastMode: true, maxDetectedFaces: 1 }) : null;
    const video = document.getElementById('video');
    const btn = document.getElementById('capture-btn');

    // 카메라 스트림 시작
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await video.play();
    } catch (err) {
      console.error('카메라 접근 오류:', err);
      alert('카메라 권한이 필요합니다.');
      return;
    }

    // 이미지 기반 언어 선택
    document.querySelectorAll('.flag-img').forEach(img => {
      img.addEventListener('click', () => {
        document.querySelectorAll('.flag-img').forEach(el => el.classList.remove('selected'));
        img.classList.add('selected');
        sessionStorage.setItem('language', img.dataset.lang);
      });
    });

    // TM 모델 초기화
    const TM_URL = "https://teachablemachine.withgoogle.com/models/sW-qqwyNh/";
    const tmModel = await tmImage.load(TM_URL + "model.json", TM_URL + "metadata.json");

    btn.addEventListener('click', async () => {
      // 사진 찍기 시점에 언어 확인
      const selectedLang = sessionStorage.getItem('language');
      if (!selectedLang) {
        alert('언어를 선택해주세요.');
        return;
      }

      btn.disabled = true;
      video.style.display = 'none';
      const canvas = document.getElementById('canvas');
      canvas.style.display = 'block';
      const ctx = canvas.getContext('2d');
      if (faceDetector) {
        try {
          const faces = await faceDetector.detect(video);
          if (faces.length > 0) {
            const { x: left, y: top, width, height } = faces[0].boundingBox;
            // 캔버스 크기 얼굴 영역에 padding 적용 및 최소 해상도 보장
            const MIN_W = 640;
            const MIN_H = 480;
            // 얼굴 영역에 20% padding 추가
            const padRatio = 0.2;
            const padX = width * padRatio;
            const padY = height * padRatio;
            // source 좌표 계산
            let sx = Math.max(0, left - padX);
            let sy = Math.max(0, top - padY);
            let sw = width + padX * 2;
            let sh = height + padY * 2;
            // 비디오 크기 한계 내로 조정
            const vidW = video.videoWidth;
            const vidH = video.videoHeight;
            if (sx + sw > vidW) sw = vidW - sx;
            if (sy + sh > vidH) sh = vidH - sy;
            // 타겟 크기 결정
            const targetW = Math.max(sw, MIN_W);
            const targetH = Math.max(sh, MIN_H);
            canvas.width = targetW;
            canvas.height = targetH;
            // 확대하여 그리기
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetW, targetH);
          } else {
            // 얼굴 미검출 시 전체를 캡처
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } catch (e) {
          console.warn('FaceDetector 오류, 전체 영역 캡처:', e);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      } else {
        // FaceDetector 미지원 시 전체 영역 캡처
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      video.srcObject.getTracks().forEach(track => track.stop());

      const image = canvas.toDataURL('image/jpeg');
      const imgEl = new Image(); imgEl.src = image; await new Promise(r => imgEl.onload = r);

      // MBTI 예측
      const preds = await tmModel.predict(imgEl, false);
      preds.sort((a, b) => b.probability - a.probability);
      const mbti = preds[0].className;

      // 노화 효과 API 호출
      let ageRes;
      try {
        ageRes = await fetch('/api/age-face', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image })
        }).then(r => r.json());
      } catch (err) {
        console.error('노화 API 오류:', err);
        alert('노화 효과 요청에 실패했습니다.');
        btn.disabled = false;
        return;
      }

      // 결과 저장 및 이동
      sessionStorage.setItem('mbti', mbti);
      sessionStorage.setItem('agedImage', ageRes.agedImage);
      location.href = 'result.html';
    });
  } else {
    const lang = sessionStorage.getItem('language');
    const mbti = sessionStorage.getItem('mbti');
    if (!lang || !mbti) return location.href = 'index.html';

    document.getElementById('aged').src = sessionStorage.getItem('agedImage');
    document.getElementById('mbti').innerText = mbti;
    const data = await fetch('db.json').then(r => r.json());
    const info = (data[lang] || {})[mbti] || {};
    document.getElementById('personality').innerText = info.성격 || '';
    document.getElementById('spouse').innerText = info.배우자 || '';
    document.getElementById('celebrity').innerText = info.유명인 || '';

    const utterText = `당신의 MBTI는 ${mbti} 입니다. 성격은 ${info.성격}. 추천 배우자 유형: ${info.배우자}. 유명인은 ${info.유명인} 입니다.`;
    const utter = new SpeechSynthesisUtterance(utterText);
    utter.lang = lang === '영어' ? 'en-US' : lang === '중국어' ? 'zh-CN' : lang === '일본어' ? 'ja-JP' : 'ko-KR';
    try {
      speechSynthesis.speak(utter);
    } catch (err) {
      console.warn('TTS blocked until user gesture:', err);
      const onFirstClick = () => {
        speechSynthesis.speak(utter);
        document.body.removeEventListener('click', onFirstClick);
      };
      document.body.addEventListener('click', onFirstClick, { once: true });
    }

    document.getElementById('reset').addEventListener('click', () => {
      sessionStorage.clear();
      location.href = 'index.html';
    });
  }
})();