(function () {
  var board = document.querySelector("#board");
  var status = document.querySelector("#status");
  var bases = {};
  var sheets = {};
  var regions = {
    left: { x: 0, y: 0, w: 0.5, h: 1 },
    right: { x: 0.5, y: 0, w: 0.5, h: 1 },
    footer: { x: 0, y: 0.8, w: 1, h: 0.2 }
  };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }
  function sheetFrom(img) {
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas;
  }
  function side() { return document.querySelector("#side").value; }
  function target() { return document.querySelector("#target").value; }
  function targets() {
    if (document.querySelector("#group").checked && target() !== "footer") return ["left", "right"];
    return [target()];
  }
  function paint(which, region, draw) {
    var canvas = sheets[which];
    var box = regions[region];
    var x = box.x * canvas.width;
    var y = box.y * canvas.height;
    var w = box.w * canvas.width;
    var h = box.h * canvas.height;
    var ctx = canvas.getContext("2d");
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    draw(ctx, x, y, w, h);
    ctx.restore();
  }
  function apply(which) {
    if (!board.model) {
      status.textContent = "The board is still loading.";
      return;
    }
    sheets[which].toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      board.createTexture(url).then(function (texture) {
        board.model.materials.forEach(function (mat) {
          if (mat.name === which) mat.pbrMetallicRoughness.baseColorTexture.setTexture(texture);
        });
      });
    });
  }

  status.textContent = "Loading the print files.";
  Promise.all([loadImage("side-a.png"), loadImage("side-b.png")]).then(function (images) {
    bases.Print_Back = images[0];
    bases.Print_Front = images[1];
    sheets.Print_Back = sheetFrom(images[0]);
    sheets.Print_Front = sheetFrom(images[1]);
    status.textContent = "Board ready. Choose a panel or the footer.";
  }).catch(function () {
    status.textContent = "The print files did not load. Refresh the page.";
  });

  document.querySelector("#file").onchange = function (event) {
    var file = event.target.files[0];
    if (!file) return;
    var img = new Image();
    img.onload = function () {
      var canvas = sheets[side()];
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      apply(side());
      status.textContent = "Full sheet placed. Split at the centre.";
    };
    img.src = URL.createObjectURL(file);
  };

  document.querySelector("#flipH").onclick = function () {
    targets().forEach(function (region) {
      paint(side(), region, function (ctx, x, y, w, h) {
        var cut = sheets[side()].getContext("2d").getImageData(x, y, w, h);
        var temp = document.createElement("canvas");
        temp.width = w;
        temp.height = h;
        temp.getContext("2d").putImageData(cut, 0, 0);
        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(temp, 0, 0);
        ctx.restore();
      });
    });
    apply(side());
    status.textContent = "Flipped horizontal.";
  };

  function rotate(dir) {
    targets().forEach(function (region) {
      var canvas = sheets[side()];
      var box = regions[region];
      var x = box.x * canvas.width;
      var y = box.y * canvas.height;
      var w = box.w * canvas.width;
      var h = box.h * canvas.height;
      var ctx = canvas.getContext("2d");
      var cut = ctx.getImageData(x, y, w, h);
      var temp = document.createElement("canvas");
      temp.width = w;
      temp.height = h;
      temp.getContext("2d").putImageData(cut, 0, 0);
      var turned = document.createElement("canvas");
      turned.width = h;
      turned.height = w;
      var tctx = turned.getContext("2d");
      tctx.translate(turned.width / 2, turned.height / 2);
      tctx.rotate(dir * Math.PI / 2);
      tctx.drawImage(temp, -w / 2, -h / 2);
      ctx.drawImage(turned, x, y, w, h);
    });
    apply(side());
    status.textContent = dir > 0 ? "Whole panel rotated clockwise." : "Whole panel rotated anti-clockwise.";
  }
  document.querySelector("#rotCw").onclick = function () { rotate(1); };
  document.querySelector("#rotCcw").onclick = function () { rotate(-1); };

  document.querySelector("#swap").onclick = function () {
    var canvas = sheets[side()];
    var ctx = canvas.getContext("2d");
    var lw = canvas.width / 2;
    var leftData = ctx.getImageData(0, 0, lw, canvas.height);
    var rightData = ctx.getImageData(lw, 0, lw, canvas.height);
    ctx.putImageData(rightData, 0, 0);
    ctx.putImageData(leftData, lw, 0);
    apply(side());
    status.textContent = "Left and right images swapped.";
  };

  document.querySelector("#reset").onclick = function () {
    sheets[side()] = sheetFrom(bases[side()]);
    apply(side());
    status.textContent = "This side is reset.";
  };

  document.querySelector("#download").onclick = function () {
    var outside = sheets.Print_Back.toDataURL("image/png");
    var inside = sheets.Print_Front.toDataURL("image/png");
    var page = [
      "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width, initial-scale=1'>",
      "<title>WEfold 2.0</title>",
      "<script type='module' src='https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'></scr" + "ipt>",
      "<style>body{margin:0;background:#f4f1ea;font-family:Helvetica,Arial,sans-serif;color:#1c1c1c}main{max-width:520px;margin:0 auto;padding:22px}h1{font-size:32px;margin:0 0 8px}.specs{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;list-style:none;padding:0}.specs span{display:block;color:#6d6a64;font-size:12px}model-viewer{width:100%;height:70vh;background:#f7f5f0;border-radius:18px}</style>",
      "</head><body><main><p>WORLDENTIRE</p><h1>WEfold 2.0</h1><p>A foldable large-format display. Two faces, one curved foot, no frame.</p>",
      "<ul class='specs'><li><strong>2.0 m</strong><span>Deployed height</span></li><li><strong>5 mm</strong><span>Swedboard</span></li><li><strong>2.6 kg</strong><span>Board weight</span></li><li><strong>5.6 m²</strong><span>Double-sided print</span></li></ul>",
      "<model-viewer id='board' src='https://moriphoto.github.io/3ddisplay/WEfold_2.0_CPI7.glb' camera-controls shadow-intensity='0.35' exposure='0.9' environment-image='neutral'></model-viewer>",
      "<p>Drag to spin.</p></main>",
      "<script type='module'>const board=document.querySelector('#board');const outside='" + outside + "';const inside='" + inside + "';board.addEventListener('load',async()=>{const a=await board.createTexture(outside);const b=await board.createTexture(inside);board.model.materials.forEach(mat=>{if(mat.name==='Print_Back')mat.pbrMetallicRoughness.baseColorTexture.setTexture(a);if(mat.name==='Print_Front')mat.pbrMetallicRoughness.baseColorTexture.setTexture(b);});});</scr" + "ipt>",
      "</body></html>"
    ].join("");
    var blob = new Blob([page], { type: "text/html" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "WEfold-2.0-spin.html";
    link.click();
    status.textContent = "Spinning page downloaded. Open that file to turn the board.";
  };
})();
