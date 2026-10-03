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
      targets().forEach(function (region) {
        paint(side(), region, function (ctx, x, y, w, h) { ctx.drawImage(img, x, y, w, h); });
      });
      apply(side());
      status.textContent = file.name + " is on the " + target() + ".";
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
    var link = document.createElement("a");
    link.href = sheets[side()].toDataURL("image/png");
    link.download = "WEfold-placement.png";
    link.click();
    status.textContent = "Placement image downloaded. Send it here and I will put it on GitHub.";
  };
})();
