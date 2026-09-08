import { sketchKindOf } from "../sketch/kinds.js";
import { useDemoStore } from "../state/useDemoStore.js";

/**
 * The point editor's own toolbar, shown while a multipoint shape is selected.
 *
 * map.army puts one at the bottom of the map — a row of small buttons that appears when a
 * graphic is marked — and the arrangement is right for a reason worth stating: these
 * controls act on the **selection**, not on the application, so they belong next to the
 * thing selected rather than in a rail that is there whether or not anything is.
 *
 * Three modes, which are map.army's three:
 *
 * - **Move** — the resting state. Handles are draggable; a click on the map still places
 *   marks, because the operator has not asked for anything else.
 * - **Add point** — "a new point is inserted for the selected graphic each time you click
 *   on the map", split into the segment nearest the click.
 * - **Remove point** — "each time you click on a point in the marked graphic, it will be
 *   removed", down to the shape's own minimum and no further.
 *
 * Space or Escape returns to Move, which is what "editing is terminated" means when there
 * is no shape in progress to terminate.
 */
export function EditToolbar(): React.JSX.Element | null {
  const editMode = useDemoStore((s) => s.editMode);
  const setEditMode = useDemoStore((s) => s.setEditMode);
  const sketch = useDemoStore((s) =>
    s.sketches.find((k) => k.id === s.selectedSketchId) ?? null,
  );
  const graphic = useDemoStore((s) =>
    s.graphics.find((g) => g.id === s.selectedGraphicId) ?? null,
  );
  const drawing = useDemoStore((s) => s.drawing);
  const sketching = useDemoStore((s) => s.sketching);

  // Not while something is being drawn: the clicks belong to that gesture, and a mode
  // switch mid-shape would silently change what the next click does.
  if (drawing || sketching) {
    return null;
  }
  const points = sketch?.points ?? graphic?.points ?? null;
  if (!points) {
    return null;
  }
  const name = sketch
    ? (sketchKindOf(sketch.kindId)?.label ?? "sketch")
    : (graphic?.name ?? "graphic");
  const floor = sketch
    ? (sketchKindOf(sketch.kindId)?.minPoints ?? 2)
    : 2;

  return (
    <div className="edittools" role="toolbar" aria-label="Point editor">
      <span className="edittools__name">{name}</span>
      <span className="edittools__count">{points.length} points</span>
      <div className="edittools__modes">
        <button
          type="button"
          className={editMode === "move" ? "tab tab--on" : "tab"}
          onClick={() => setEditMode("move")}
          title="Drag the numbered handles to move a point"
        >
          Move
        </button>
        <button
          type="button"
          className={editMode === "add" ? "tab tab--on" : "tab"}
          onClick={() => setEditMode("add")}
          title="Each click on the map inserts a point into the nearest segment"
        >
          Add point
        </button>
        <button
          type="button"
          className={editMode === "remove" ? "tab tab--on" : "tab"}
          onClick={() => setEditMode("remove")}
          disabled={points.length <= floor}
          title={
            points.length <= floor
              ? `This shape needs at least ${floor} points`
              : "Each click on a handle removes that point"
          }
        >
          Remove point
        </button>
      </div>
      <span className="edittools__hint">
        {editMode === "move"
          ? "drag a handle"
          : editMode === "add"
            ? "click the map to insert"
            : "click a handle to delete"}
        {editMode === "move" ? "" : " · space or Esc to stop"}
      </span>
    </div>
  );
}
