import { Injectable, OnDestroy } from '@angular/core';
import Konva from 'konva';
import { PrintArea } from '@core/models/product.model';

export interface CanvasAsset {
  backendAssetId: number | null;
  konvaNode: Konva.Image;
  file: File;
  uploaded: boolean;
}

export interface CanvasText {
  konvaNode: Konva.Text;
  id: string;
}

export interface PrintAreaBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Encapsulates all Konva canvas operations.
 *
 * Provided at component level (see CustomizerComponent.providers) so each
 * customizer instance gets a fresh, isolated canvas service.
 */
@Injectable()
export class KonvaCanvasService implements OnDestroy {
  private readonly CANVAS_SIZE = 600;

  private stage!: Konva.Stage;
  private mockupLayer!: Konva.Layer;
  private userLayer!: Konva.Layer;
  private guideLayer!: Konva.Layer;
  private printableRect!: Konva.Rect;
  private transformers: Konva.Transformer[] = [];
  private printArea: PrintArea | null = null;

  readonly assets: CanvasAsset[] = [];
  readonly textLayers: CanvasText[] = [];

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init(container: HTMLDivElement): void {
    this.stage = new Konva.Stage({
      container,
      width: this.CANVAS_SIZE,
      height: this.CANVAS_SIZE,
    });

    this.mockupLayer = new Konva.Layer();
    this.mockupLayer.listening(false);
    this.stage.add(this.mockupLayer);

    this.userLayer = new Konva.Layer();
    this.stage.add(this.userLayer);

    this.guideLayer = new Konva.Layer();
    this.guideLayer.listening(false);
    this.stage.add(this.guideLayer);

    this.printableRect = new Konva.Rect({
      x: 50, y: 50,
      width: this.CANVAS_SIZE - 100,
      height: this.CANVAS_SIZE - 100,
      stroke: '#94a3b8',
      strokeWidth: 1,
      dash: [5, 5],
      listening: false,
    });
    this.guideLayer.add(this.printableRect);
    this.guideLayer.draw();

    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) {
        this.deselectAll();
      }
    });
  }

  ngOnDestroy(): void {
    this.stage?.destroy();
  }

  // ── Mockup ─────────────────────────────────────────────────────────────────

  loadMockup(imageUrl: string | null): void {
    if (!imageUrl) {
      const placeholder = new Konva.Rect({
        x: 0, y: 0,
        width: this.CANVAS_SIZE, height: this.CANVAS_SIZE,
        fill: '#f8fafc', listening: false,
      });
      this.mockupLayer.add(placeholder);
      this.mockupLayer.draw();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const scale = Math.min(this.CANVAS_SIZE / img.width, this.CANVAS_SIZE / img.height);
      const scaledW = img.width * scale;
      const scaledH = img.height * scale;
      const offsetX = (this.CANVAS_SIZE - scaledW) / 2;
      const offsetY = (this.CANVAS_SIZE - scaledH) / 2;

      const konvaMockup = new Konva.Image({
        x: offsetX, y: offsetY,
        image: img,
        width: scaledW, height: scaledH,
        listening: false, draggable: false,
      });

      this.mockupLayer.destroyChildren();
      this.mockupLayer.add(konvaMockup);
      this.mockupLayer.draw();
    };
    img.onerror = () => this.mockupLayer.draw();
    img.src = imageUrl;
  }

  // ── Print area guide ───────────────────────────────────────────────────────

  updatePrintArea(pa: PrintArea): void {
    this.printArea = pa;
    const scaleX = this.CANVAS_SIZE / pa.canvasWidth;
    const scaleY = this.CANVAS_SIZE / pa.canvasHeight;
    this.printableRect.setAttrs({
      x: pa.printableX * scaleX,
      y: pa.printableY * scaleY,
      width: pa.printableWidth * scaleX,
      height: pa.printableHeight * scaleY,
    });
    this.guideLayer.draw();
  }

  getPrintAreaBounds(): PrintAreaBounds {
    if (!this.printArea) {
      return { x: 0, y: 0, w: this.CANVAS_SIZE, h: this.CANVAS_SIZE };
    }
    const sx = this.CANVAS_SIZE / this.printArea.canvasWidth;
    const sy = this.CANVAS_SIZE / this.printArea.canvasHeight;
    return {
      x: this.printArea.printableX * sx,
      y: this.printArea.printableY * sy,
      w: this.printArea.printableWidth * sx,
      h: this.printArea.printableHeight * sy,
    };
  }

  // ── Image assets ───────────────────────────────────────────────────────────

  addImage(imageObj: HTMLImageElement, file: File): void {
    const bounds = this.getPrintAreaBounds();
    const maxFit = Math.min(bounds.w, bounds.h) * 0.6;
    let imgW = imageObj.width;
    let imgH = imageObj.height;
    if (imgW > maxFit || imgH > maxFit) {
      const ratio = Math.min(maxFit / imgW, maxFit / imgH);
      imgW *= ratio;
      imgH *= ratio;
    }

    const initX = bounds.x + (bounds.w - imgW) / 2;
    const initY = bounds.y + (bounds.h - imgH) / 2;

    const konvaImage = new Konva.Image({
      x: initX, y: initY,
      image: imageObj,
      width: imgW, height: imgH,
      draggable: true,
    });

    konvaImage.on('click tap', () => {
      this.deselectAll();
      const tr = this.transformers.find(t => t.getAttr('_targetNode') === konvaImage);
      if (tr) { tr.nodes([konvaImage]); this.userLayer.draw(); }
    });

    konvaImage.on('dragmove', () => this.clampImageToBounds(konvaImage));

    const transformer = this.createTransformer(konvaImage);
    this.userLayer.add(konvaImage);
    this.userLayer.add(transformer);

    const asset: CanvasAsset = { backendAssetId: null, konvaNode: konvaImage, file, uploaded: false };
    this.assets.push(asset);
    this.transformers.push(transformer);

    this.deselectAll();
    transformer.nodes([konvaImage]);
    this.userLayer.draw();
  }

  selectAsset(index: number): void {
    const asset = this.assets[index];
    this.deselectAll();
    const tr = this.transformers.find(t => t.getAttr('_targetNode') === asset.konvaNode);
    if (tr) { tr.nodes([asset.konvaNode]); this.userLayer.draw(); }
  }

  removeAsset(index: number): void {
    const asset = this.assets[index];
    this.removeTransformerFor(asset.konvaNode);
    asset.konvaNode.destroy();
    this.userLayer.draw();
    this.assets.splice(index, 1);
  }

  // ── Text layers ────────────────────────────────────────────────────────────

  addText(
    text: string,
    fontFamily: string,
    fontSize: number,
    fontStyle: string,
    fill: string,
  ): void {
    const bounds = this.getPrintAreaBounds();
    const konvaText = new Konva.Text({
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      text,
      fontFamily,
      fontSize,
      fontStyle,
      fill,
      draggable: true,
    });

    konvaText.offsetX(konvaText.width() / 2);
    konvaText.offsetY(konvaText.height() / 2);

    konvaText.on('click tap', () => {
      this.deselectAll();
      const tr = this.transformers.find(t => t.getAttr('_targetNode') === konvaText);
      if (tr) { tr.nodes([konvaText]); this.userLayer.draw(); }
    });

    konvaText.on('dragmove', () => {
      const b = this.getPrintAreaBounds();
      konvaText.x(Math.max(b.x, Math.min(konvaText.x(), b.x + b.w)));
      konvaText.y(Math.max(b.y, Math.min(konvaText.y(), b.y + b.h)));
    });

    const transformer = this.createTransformer(konvaText);
    this.userLayer.add(konvaText);
    this.userLayer.add(transformer);

    const id = `text-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.textLayers.push({ konvaNode: konvaText, id });
    this.transformers.push(transformer);

    this.deselectAll();
    transformer.nodes([konvaText]);
    this.userLayer.draw();
  }

  selectTextLayer(index: number): void {
    const tl = this.textLayers[index];
    this.deselectAll();
    const tr = this.transformers.find(t => t.getAttr('_targetNode') === tl.konvaNode);
    if (tr) { tr.nodes([tl.konvaNode]); this.userLayer.draw(); }
  }

  removeTextLayer(index: number): void {
    const tl = this.textLayers[index];
    this.removeTransformerFor(tl.konvaNode);
    tl.konvaNode.destroy();
    this.userLayer.draw();
    this.textLayers.splice(index, 1);
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private deselectAll(): void {
    this.transformers.forEach(tr => tr.nodes([]));
    this.userLayer.draw();
  }

  private createTransformer(node: Konva.Node): Konva.Transformer {
    const transformer = new Konva.Transformer({
      nodes: [],
      rotateEnabled: true,
      enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
      boundBoxFunc: (oldBox, newBox) => {
        if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) return oldBox;
        const b = this.getPrintAreaBounds();
        if (
          newBox.x < b.x || newBox.y < b.y ||
          newBox.x + newBox.width > b.x + b.w ||
          newBox.y + newBox.height > b.y + b.h
        ) return oldBox;
        return newBox;
      },
    });
    transformer.setAttr('_targetNode', node);
    return transformer;
  }

  private clampImageToBounds(konvaImage: Konva.Image): void {
    const b = this.getPrintAreaBounds();
    const effectiveW = konvaImage.width() * konvaImage.scaleX();
    const effectiveH = konvaImage.height() * konvaImage.scaleY();
    if (effectiveW <= b.w) {
      konvaImage.x(Math.max(b.x, Math.min(konvaImage.x(), b.x + b.w - effectiveW)));
    } else {
      konvaImage.x(Math.max(b.x + b.w - effectiveW, Math.min(konvaImage.x(), b.x)));
    }
    if (effectiveH <= b.h) {
      konvaImage.y(Math.max(b.y, Math.min(konvaImage.y(), b.y + b.h - effectiveH)));
    } else {
      konvaImage.y(Math.max(b.y + b.h - effectiveH, Math.min(konvaImage.y(), b.y)));
    }
  }

  private removeTransformerFor(node: Konva.Node): void {
    const idx = this.transformers.findIndex(tr => tr.getAttr('_targetNode') === node);
    if (idx >= 0) {
      this.transformers[idx].destroy();
      this.transformers.splice(idx, 1);
    }
  }
}
