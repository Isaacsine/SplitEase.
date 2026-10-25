import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
import workerUrl from "tesseract.js/dist/worker.min.js?url";
import { useShop } from "../features/shops/useShop";
import {
  parseReceipt,
  assignReceipt,
  type ReceiptItem,
} from "../features/receipts/receipt";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { formatZAR } from "../lib/money";
export function ReceiptPage() {
  const { shop, updateShop } = useShop();
  const [text, setText] = useState(""),
    [items, setItems] = useState<ReceiptItem[]>([]),
    [expected, setExpected] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [image, setImage] = useState("");
  const worker = useRef<Worker | null>(null),
    sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
      void worker.current?.terminate().catch(() => {});
    },
    [],
  );
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image);
    },
    [image],
  );
  function extract(value = text) {
    const parsed = parseReceipt(value);
    setItems(parsed.items);
    setExpected(
      (parsed.total || parsed.items.reduce((s, i) => s + i.cents, 0)) / 100,
    );
    setError(
      parsed.items.length
        ? ""
        : "No priced items found. Edit the text or add items manually.",
    );
  }
  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024)
      return setError("Choose a receipt image smaller than 10 MB.");
    const seq = ++sequence.current;
    setBusy(true);
    setError("");
    setProgress("Loading on-device text recognition...");
    try {
      const bitmap = await createImageBitmap(file);
      const size = bitmap.width * bitmap.height;
      bitmap.close();
      if (size > 25000000) throw Error("Use an image under 25 megapixels.");
      setImage(URL.createObjectURL(file));
      const { createWorker } = await import("tesseract.js");
      const active = await createWorker("eng", 1, {
        workerPath: workerUrl,
        workerBlobURL: false,
        logger: (m) => {
          if (sequence.current === seq)
            setProgress(
              m.status + " " + Math.round((m.progress || 0) * 100) + "%",
            );
        },
      });
      if (sequence.current !== seq) {
        await active.terminate();
        return;
      }
      worker.current = active;
      const result = await active.recognize(file);
      if (sequence.current === seq) {
        setText(result.data.text);
        extract(result.data.text);
        setProgress("Text extracted. Review every amount and assignment.");
      }
    } catch (e) {
      if (sequence.current === seq)
        setError(
          e instanceof Error
            ? e.message
            : "Could not read this image. Paste receipt text or enter items manually.",
        );
    } finally {
      if (sequence.current === seq) {
        await worker.current?.terminate().catch(() => {});
        worker.current = null;
        setBusy(false);
      }
    }
  }
  const cents = items.reduce((s, i) => s + i.cents, 0);
  function edit(id: string, data: Partial<ReceiptItem>) {
    setItems((old) => old.map((i) => (i.id === id ? { ...i, ...data } : i)));
    setError("");
  }
  function apply() {
    try {
      if (busy) throw Error("Finish receipt recognition first.");
      if (shop.participants.length < 2)
        throw Error("Add at least two people to your split first.");
      if (
        !Number.isFinite(expected) ||
        Math.round(expected * 100) !== cents ||
        Math.abs(expected * 100 - Math.round(expected * 100)) > 0.00001
      )
        throw Error("Reviewed items must add up exactly to the receipt total.");
      if (cents <= 0 || cents > 100000000)
        throw Error("Receipt total must be between R 0.01 and R 1,000,000.");
      const shares = assignReceipt(
        items,
        shop.participants.map((p) => p.id),
      );
      updateShop({
        shopName: shop.shopName || "Receipt split",
        totalAmount: cents / 100,
        splitMethod: "amount",
        participants: shop.participants.map((p) => ({
          ...p,
          share: shares[p.id] / 100,
        })),
      });
      location.hash = "pay";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Check receipt items.");
    }
  }
  return (
    <section className="panel receipt-page">
      <span className="pill">Receipt to split</span>
      <h2 className="requestheading">Split a receipt</h2>
      <p className="muted">
        Upload an image, review its text and prices, then assign items.
        Recognition runs in your browser; the receipt image is not uploaded to
        our backend. The OCR engine and language data download when first used.
      </p>
      <div className="actions">
        <label className="button secondary upload">
          Upload receipt image
          <input
            type="file"
            accept="image/*"
            aria-label="Upload receipt image"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.[0]) void upload(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </label>

        {busy && (
          <Button
            variant="ghost"
            onClick={() => {
              sequence.current++;
              void worker.current?.terminate().catch(() => {});
              worker.current = null;
              setBusy(false);
              setProgress("Recognition cancelled.");
            }}
          >
            Cancel recognition
          </Button>
        )}
      </div>
      {progress && <p role="status">{progress}</p>}
      {image && (
        <img
          className="receipt-image"
          src={image}
          alt="Receipt being reviewed"
        />
      )}
      <div className="field">
        <label htmlFor="receipt-text">
          Receipt text - review or paste manually
        </label>
        <textarea
          id="receipt-text"
          value={text}
          rows={7}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Pizza 100.00\nDrinks 50.00\nTOTAL 150.00"}
        />
      </div>
      <div className="actions">
        <Button variant="secondary" disabled={busy} onClick={() => extract()}>
          Extract items from text
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() =>
            setItems((old) => [
              ...old,
              { id: crypto.randomUUID(), name: "", cents: 0, assigned: [] },
            ])
          }
        >
          Add receipt item
        </Button>
      </div>
      {shop.participants.length < 2 && (
        <p className="notice">
          Add your group on the Split page before assigning the receipt. Your
          draft will be kept while you navigate.
        </p>
      )}
      {items.map((item, index) => (
        <article className="receipt-item" key={item.id}>
          <div className="grid">
            <Input
              label={"Item " + (index + 1) + " description"}
              value={item.name}
              maxLength={120}
              onChange={(e) => edit(item.id, { name: e.target.value })}
            />
            <Input
              label={"Item " + (index + 1) + " amount"}
              type="number"
              min="0.01"
              step="0.01"
              value={item.cents ? item.cents / 100 : ""}
              onChange={(e) =>
                edit(item.id, {
                  cents: Math.round(Number(e.target.value) * 100),
                })
              }
            />
          </div>
          <fieldset>
            <legend>Who shares this item?</legend>
            <div className="assignment-options">
              {shop.participants.map((p) => (
                <label className="assignment-choice" key={p.id}>
                  <input
                    type="checkbox"
                    aria-label={"Assign item " + (index + 1) + " to " + p.name}
                    checked={item.assigned.includes(p.id)}
                    onChange={(e) =>
                      edit(item.id, {
                        assigned: e.target.checked
                          ? [...item.assigned, p.id]
                          : item.assigned.filter((id) => id !== p.id),
                      })
                    }
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
          <Button
            variant="ghost"
            onClick={() =>
              setItems((old) => old.filter((i) => i.id !== item.id))
            }
          >
            Remove item {index + 1}
          </Button>
        </article>
      ))}
      {items.length > 0 && (
        <>
          <Button
            variant="secondary"
            onClick={() =>
              setItems((old) =>
                old.map((i) => ({
                  ...i,
                  assigned: shop.participants.map((p) => p.id),
                })),
              )
            }
          >
            Share every item with everyone
          </Button>
          <Input
            label="Receipt total to verify"
            type="number"
            min="0.01"
            step="0.01"
            value={expected || ""}
            onChange={(e) => setExpected(Number(e.target.value))}
          />
          <div className="coverage-total">
            <strong>Reviewed item total</strong>
            <span>{formatZAR(cents / 100)}</span>
          </div>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <Button
          disabled={busy || !items.length || shop.participants.length < 2}
          onClick={apply}
        >
          Apply item shares to split
        </Button>
        <a className="button ghost" href="#pay">
          Back to split
        </a>
      </div>
    </section>
  );
}
