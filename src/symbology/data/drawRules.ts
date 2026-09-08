// GENERATED FILE — do not edit by hand.
//
// MIL-STD-2525's anchor point rules, extracted from
// node_modules/@armyc2.c5isr.renderer/mil-sym-ts-web/C5Ren.d.mts by
// scripts/gen-draw-rules.mjs. 89 rules, 87 of them with an
// anchor-point description.
//
// `MSInfo.getDrawRule()` gives a number and `DrawRules` gives that number a name, but
// neither says what the points MEAN — and for the arrow, corridor and rectangle rules the
// points are not a path. AXIS2's first point is the tip of the arrowhead and its last is a
// width, so a tool that collects clicks as a tail-to-tip path draws it backwards.
//
// The text is the standard's own, quoted verbatim. Regenerate with:
//
//   node scripts/gen-draw-rules.mjs

export interface DrawRuleText {
  /** What each anchor point means, in the standard's words. */
  readonly anchorPoints: string;
  /** What the points determine about size and shape. */
  readonly sizeShape: string;
  /** Which way the symbol faces, where the standard says. */
  readonly orientation: string;
}

/** Keyed by `DrawRules` constant name — `AXIS2`, `AREA1`, `CORRIDOR1`. */
export const DRAW_RULE_TEXT: Readonly<Record<string, DrawRuleText>> = {
  DONOTDRAW: {
    anchorPoints: "",
    sizeShape: "",
    orientation: "",
  },
  AREA1: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area. Add as many points as necessary to accurately reflect the area’s size and shape.",
    sizeShape: "Determined by the anchor points. The information fields should be moveable and scalable as a block within the area.",
    orientation: "",
  },
  AREA2: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area. Add as many points as necessary to accurately reflect the area’s size and shape. The LAA point symbol requires one anchor point and is connected to the area symbol with a straight line.",
    sizeShape: "Determined by the anchor points. The information fields should be moveable and scalable as a block within the area.",
    orientation: "",
  },
  AREA3: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area. Add as many points as necessary to accurately reflect the area’s size and shape.",
    sizeShape: "Determined by the anchor points.",
    orientation: "",
  },
  AREA4: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area. Add as many points as necessary to accurately reflect the area’s size and shape.",
    sizeShape: "Determined by the anchor points. The information fields should be moveable and scalable as a block within the area. The default tic length should be the same as the text height of the echelon field (B). Spacing between the tics should also be the height of B. Users should be provided a facility to allow them to manually alter the height of B, which in turn should affect the tic length and spacing accordingly.",
    orientation: "",
  },
  AREA5: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the semicircle's opening. Point 3 defines the end of the arrow.",
    sizeShape: "Points 1 and 2 determine the diameter of the semicircle and point 3 determines the length of the arrow. The tip of the arrowhead will be at the center point of the semicircle's diameter and will project perpendicularly from the line between points 1 and 2. The default tic length should be the same as the text height of the echelon field (B). Spacing between the tics should also be the height of B. Users should be provided a facility to allow them to manually alter the height of B, which in turn should affect the tic length and spacing accordingly.",
    orientation: "",
  },
  AREA6: {
    anchorPoints: "This symbol requires two anchor points. Point 1 defines the center point of the symbol and point 2 defines the symbol’s start point and radius.",
    sizeShape: "Points 1 and 2 will determine a radius that is long enough for the graphic to encompass the feature(s) being retained. The opening will be a 30-degree arc of the circle. The default tic length should be the same as the text height of the echelon field (R). Spacing between the tics should also be the height of R. Users should be provided a facility to allow them to manually alter the height of R, which in turn should affect the tic length and spacing accordingly.",
    orientation: "",
  },
  AREA7: {
    anchorPoints: "This symbol requires three anchor points. Point 1 is the tip of the arrowhead. Points 2 and 3 define the endpoints of the straight line on the back side of the symbol.",
    sizeShape: "Points 2 and 3 determine the length of the straight line on the back side of the symbol. The rear of the arrowhead line shall connect to the midpoint of the line between points 2 and 3. The arrowhead line shall be perpendicular to the line formed by points 2 and 3.",
    orientation: "Orientation is determined by the anchor points. The back side of the symbol encompasses the firing position, while the arrowhead typically points at the target.",
  },
  AREA8: {
    anchorPoints: "This symbol requires four anchor points. Points 1 and 2 define the endpoints of the straight line on the back side of the symbol. Points 3 and 4 define the tips of the arrowheads.",
    sizeShape: "Points 1 and 2 determine the length of the straight line on the back side of the symbol. The rear of the arrows should connect to points 1 and 2.",
    orientation: "Orientation is determined by the anchor points. The back side of the symbol encompasses the firing position, while the arrowheads typically indicate the left and right limits of coverage that the firing position is meant to support.",
  },
  AREA9: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area. Add as many points as necessary to accurately reflect the area’s size and shape.",
    sizeShape: "Determined by the anchor points.",
    orientation: "Not applicable. The area will encompass two or more fire support symbols (point/single target, nuclear target, circular target, rectangular target, or area target). The naming convention determines whether the area describes a series or group of targets.",
  },
  AREA10: {
    anchorPoints: "This symbol requires a minimum of three (3) and a maximum of six (6) anchor points to define the boundary of the area. The anchor points shall be sequentially numbered, in increments of one (1), beginning with point one (1).",
    sizeShape: "Determined by the anchor points. The information fields should be moveable and scalable within the area.",
    orientation: "",
  },
  AREA11: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the symbol’s vertical line. Point 3 defines the endpoint of the symbol’s horizontal line.",
    sizeShape: "Points 1 and 2 determine the length of the vertical line. The length of the horizontal line is determined by plotting point 3 on a plane extending perpendicularly from the midpoint of the vertical line.",
    orientation: "The head of the \"T\" typically faces enemy forces.",
  },
  AREA12: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the end points of the symbol’s vertical line. Point 3 defines the tip of the longest arrow.",
    sizeShape: "Points 1 and 2 determine the height of the symbol and point 3 determines its length. The spacing between the symbol’s arrows will stay proportional to the symbol’s vertical line. The length of the short arrows will remain in proportion to the length of the longest arrow.",
    orientation: "The arrows point away from enemy forces.",
  },
  AREA13: {
    anchorPoints: "This symbol requires at least two anchor points. Points 1 and 2 define the corners of the symbol.",
    sizeShape: "Points 1 and 2 determine the length of the straight line. The radius of the semicircle is ½ the length of the straight line.",
    orientation: "",
  },
  AREA14: {
    anchorPoints: "This symbol requires three anchor points. The center point defines the center of the symbol. Points 1 and 2 define the radii of circles 1 and 2.",
    sizeShape: "As defined by the operator.",
    orientation: "The center point is typically centered over Ground Zero (GZ) or Designated Ground Zero (DGZ).",
  },
  AREA15: {
    anchorPoints: "This symbol requires two anchor points. Point 1 defines the center point of the symbol and point 2 defines the symbol’s start point and radius.",
    sizeShape: "The radius will be long enough for the symbol to encompass the UEI(s) or feature(s) being isolated. The opening will be a 30 degree arc of the circle.",
    orientation: "The opening will be on the friendly side of the symbol.",
  },
  AREA16: {
    anchorPoints: "This symbol requires two anchor points. Point 1 defines the center point of the symbol and point 2 defines the symbol’s start point and radius.",
    sizeShape: "Points 1 and 2 will determine a radius that is long enough for the symbol to encompass the feature(s) being occupied. The opening will be a 30-degree arc of the circle.",
    orientation: "The opening will be on the friendly side of the control measure.",
  },
  AREA17: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the symbol’s vertical line. Point 3 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the height of the symbol and point 3 determines its length. The arrow will project perpendicularly from the midpoint of the vertical line.",
    orientation: "The arrow points toward enemy forces.",
  },
  AREA18: {
    anchorPoints: "This symbol requires four anchor points. Point 1 defines the tip of the first arrowhead. Point 2 defines the end of the straight line portion of the first arrow. Point 3 defines the tip of the second arrowhead. Point 4 defines the end of the second arrow.",
    sizeShape: "Points 1 and 2 and points 3 and 4 determine the length of each arrow. Points 2 and 3 shall be connected by a smooth, curved line.",
    orientation: "Determined by the anchor points. The unit being relieved is typically located at the base of the curve and the unit performing the relief is typically located at the end of the symbol. The arrowhead typically points to the location the relieved unit should move to.",
  },
  AREA19: {
    anchorPoints: "This symbol requires two anchor points. Point 1 defines the center point of the symbol and point 2 defines the symbol’s start point and radius.",
    sizeShape: "Points 1 and 2 will determine a radius that is long enough for the symbol to encompass the feature(s) being secured. The opening will be a 30-degree arc of the circle.",
    orientation: "The opening will be on the friendly side of the symbol.",
  },
  AREA20: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area. Add as many points as necessary to accurately reflect the area’s size and shape.",
    sizeShape: "Determined by the anchor points.",
    orientation: "",
  },
  AREA21: {
    anchorPoints: "This symbol requires three anchor points. Point 1 defines the vertex of the symbol. Points 2 and 3 define the tips of the arrowheads.",
    sizeShape: "Points 1 and 2 and points 1 and 3 determine the length of the arrows. The length and orientation of the arrows can vary independently.",
    orientation: "Orientation is determined by the anchor points. The arrowheads may touch other symbols that define the limits of the task. The tactical symbol indicator is centered over point 1.",
  },
  AREA22: {
    anchorPoints: "This symbol requires one anchor point. The center point defines the center of the symbol.",
    sizeShape: "Static.",
    orientation: "The symbol is typically centered over the desired location.",
  },
  AREA23: {
    anchorPoints: "This symbol requires at least three anchor points to define the boundary of the area.",
    sizeShape: "Determined by the anchor points",
    orientation: "",
  },
  AREA24: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the symbol’s vertical line. Point 3 defines the endpoint of the symbol’s horizontal line.",
    sizeShape: "Points 1 and 2 determine the length of the vertical line. Points 2 and 3 determine the length of the horizontal line, which will project perpendicularly from the midpoint of the vertical line.",
    orientation: "The head of the \"T\" typically faces enemy forces.",
  },
  AREA25: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the end points of the symbol’s vertical line. Point 3 defines the tip of the longest arrow.",
    sizeShape: "Points 1 and 2 determine the height of the symbol and point 3 determines its length. The spacing between the symbol’s arrows will stay proportional to the symbol’s vertical line. The length of the short arrows will remain in proportion to the length of the longest arrow. The arrows are perpendicular to the baseline (vertical line) and parallel to each other.",
    orientation: "The arrows typically point toward enemy forces.",
  },
  AREA26: {
    anchorPoints: "This symbol requires a minimum of 6 anchor points. Add as many pairs of points as needed to accurately define the areas. The number of points shall always be an even number, with an equal number of points for both polygons. Points 1 through N/2 define the inner safe zone (zone 1). Points N/2 +1 though point N defines the outer zone (zone 2).",
    sizeShape: "Determined by the anchor points.",
    orientation: "The symbol will typically be oriented upright.",
  },
  AREA27: {
    anchorPoints: "This symbol requires three anchor points. Point 1 defines the tip of the arrowhead. Point 2 defines the end of the straight-line portion of the symbol. Point 3 defines the diameter and orientation of the 180 degree circular arc.",
    sizeShape: "Points 1 and 2 determine the length of the straight-line portion of the symbol. Point 3 defines which side of the line the arc is on and the diameter of the arc",
    orientation: "Determined by the anchor points.",
  },
  POINT1: {
    anchorPoints: "This symbol requires one anchor point. The anchor point defines/is the tip of the inverted cone.",
    sizeShape: "Static.",
    orientation: "The symbol will typically be oriented upright.",
  },
  POINT2: {
    anchorPoints: "This symbol requires one anchor point. The center point defines/is the center of the symbol.",
    sizeShape: "Static.",
    orientation: "The symbol is typically centered over the desired location.",
  },
  POINT3: {
    anchorPoints: "This symbol requires one anchor point. The center point defines the center of the symbol.",
    sizeShape: "Static. Maneuver area symbol shall be drawn with a black border. Maneuver areas may be either unfilled or filled with performance-contoured color options",
    orientation: "The symbol is typically centered over the desired location.",
  },
  POINT4: {
    anchorPoints: "This symbol requires one anchor point. The point defines the bottom of the central vertical line in the symbol where the curved and vertical lines meet.",
    sizeShape: "Static.",
    orientation: "The symbol will typically be oriented upright (as shown in the template and example).",
  },
  POINT5: {
    anchorPoints: "This symbol requires one anchor point. The point defines the point where all the lines meet.",
    sizeShape: "Static.",
    orientation: "The symbol will typically be oriented upright (as shown in the example).",
  },
  POINT6: {
    anchorPoints: "This symbol requires one anchor point. The anchor point defines/is the center of the bottom of the control measure symbol as shown in the template and example.",
    sizeShape: "Static.",
    orientation: "The symbol will typically be oriented upright.",
  },
  POINT7: {
    anchorPoints: "This symbol requires one anchor point. The anchor point defines the midpoint of the symbol's base.",
    sizeShape: "Static.",
    orientation: "The symbol will typically be oriented upright (as shown in the template and example).",
  },
  POINT8: {
    anchorPoints: "This symbol requires one anchor point. The center point defines the center of the symbol.",
    sizeShape: "Static. The symbol's corners form a 70- degree angle.",
    orientation: "The symbol is typically centered over the desired location. A user can use this symbol to define a new type of point if the selection that follows is not sufficient.",
  },
  POINT9: {
    anchorPoints: "This symbol requires one anchor (center) point. The point defines the center of the symbol.",
    sizeShape: "Static. The symbol's height should be 2x the symbol's width.",
    orientation: "The symbol's center point is typically centered over the desired location. The symbol shall be oriented upright, as shown in the examples.",
  },
  POINT10: {
    anchorPoints: "This symbol requires one anchor point. The point defines the center of the circle. (Sonobuoy)",
    sizeShape: "Static. The diameter of the circle should be 1/2 the height of the symbol.",
    orientation: "The symbol's center point is typically centered over the desired location. The symbol will be oriented upright, as shown in the example.",
  },
  POINT11: {
    anchorPoints: "This symbol requires one center point. The point defines the center of the symbol.",
    sizeShape: "Static. Length is 2x the size of height.",
    orientation: "The symbol is centered over the desired location. The symbol shall be oriented upright, as shown in the example.",
  },
  POINT12: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the tips of the arrowheads and point 3 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the symbol's height and point 3 determines its length. The vertical line at the rear of the symbol shall be the same length as the opening, and shall be perpendicular to the parallel lines formed with the rear of symbol vertical line and the lines ending with points 1 and 2.",
    orientation: "The opening typically faces the applicable obstacle.",
  },
  POINT13: {
    anchorPoints: "This symbol requires one anchor point. The center point defines the center of the circle.",
    sizeShape: "Static.",
    orientation: "The symbol is typically centered over the desired location.",
  },
  POINT14: {
    anchorPoints: "This symbol requires one anchor point. The center point defines the center of the symbol.",
    sizeShape: "There should be 45 degrees of angular separation between the two arrows.",
    orientation: "The symbol is typically centered over the desired location.",
  },
  POINT15: {
    anchorPoints: "This symbol requires one anchor point. The anchor point defines \"nose\" of the symbol.",
    sizeShape: "Static.",
    orientation: "The symbol is typically centered over the desired location.",
  },
  POINT16: {
    anchorPoints: "This symbol requires one anchor point; the point defines the circle at the base of the tower.",
    sizeShape: "The symbol is a high-angle cone.",
    orientation: "The symbol will remain upright.",
  },
  POINT17: {
    anchorPoints: "This symbol requires one anchor point. This anchor point represents the center of the rectangle and, therefore, the geographic location of that rectangle.",
    sizeShape: "The size and shape of this symbol is determined by three additional numeric values; A length (AM1), a width (AM2), and a rotation angle. The length and width should be expressed in the appropriate map distance units. The length is aligned with the axis of rotation. The width is aligned perpendicular to the axis of rotation.",
    orientation: "The orientation of this symbol is determined by the rotation angle provided, where 0 degrees is North and a positive rotation angle rotates the rectangle in a clockwise direction.",
  },
  POINT18: {
    anchorPoints: "This symbol requires one anchor point that defines the axis of angular rotation.",
    sizeShape: "The size and shape of this symbol is determined by additional numeric values; A search axis azimuth, a start range, a stop range and a stop relative bearing. The stop relative bearing is an equal angle either side of the search axis. The start and stop range should be expressed in the appropriate map distance units. Field T should be positioned in the center of the search area aligned with the search axis.",
    orientation: "The orientation of this symbol is determined by the search axis azimuth provided.",
  },
  LINE1: {
    anchorPoints: "This symbol requires at least two anchor points, points 1 and 2, to define the line. Additional points can be defined to extend the line.",
    sizeShape: "The first and last anchor points determine the length of the line.",
    orientation: "Orientation is determined by the order in which the anchor points are entered.",
  },
  LINE2: {
    anchorPoints: "This symbol requires at least two anchor points, points 1 and 2, to define the line. Additional points can be defined to extend the line.",
    sizeShape: "The first and last anchor points determine the length of the line. The end-of line information will typically be posted at the ends of the line as it is displayed on the screen.",
    orientation: "Orientation is determined by the order in which the anchor points are entered.",
  },
  LINE3: {
    anchorPoints: "This symbol requires three anchor points. Point 1 defines the vertex of the symbol. Points 2 and 3 define the tips of the arrowheads.",
    sizeShape: "The length and orientation of the arrows can vary independently.",
    orientation: "Orientation is determined by the anchor points. The arrowheads may touch other symbols that define the limits of the task. The top of the tactical symbol indicator may touch point 1",
  },
  LINE4: {
    anchorPoints: "This symbol requires two anchor points. Points 1 and 2 define the corner points of the symbol.",
    sizeShape: "The symbol varies only in length.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE5: {
    anchorPoints: "This symbol requires two anchor points. Points 1 and 2 define the endpoints of the symbol.",
    sizeShape: "The symbol varies only in length.",
    orientation: "One point defines the origin from which the bearing is being taken and the other point defines the location or direction from which a contact is made.",
  },
  LINE6: {
    anchorPoints: "This symbol requires 3 anchor points. Point 1 defines the vertex of the symbol and points 2 and 3 define its endpoints.",
    sizeShape: "Points 1, 2 and 3 determine the length of the lines connecting them. The line defined by points 1 and 2 is typically the same length as the line between points 2 and 3.",
    orientation: "Orientation is determined by the anchor points",
  },
  LINE7: {
    anchorPoints: "This symbol requires at least two anchor points, points 1 and 2, to define the line. Additional points can be defined to extend the line.",
    sizeShape: "The first and last anchor points determine the length of the line. The line information will be posted once at the center of the line as it is displayed on the screen.",
    orientation: "Orientation is determined by the order in which the anchor points are entered.",
  },
  LINE8: {
    anchorPoints: "This symbol requires a minimum of two (2) anchor points. Up to 298 additional points can be added to extend the line. The first point (point 1) defines the start point. The last point defines the endpoint. The points are numbered sequentially beginning with point one (1), in increments of one.",
    sizeShape: "The anchor points define the size and shape.",
    orientation: "The orientation is determined by the anchor points.",
  },
  LINE9: {
    anchorPoints: "This symbol requires 2 anchor points. Point 1 defines the tip of the arrowhead and point 2 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the length of the symbol, which varies only in length.",
    orientation: "The orientation is determined by the anchor points.",
  },
  LINE10: {
    anchorPoints: "This symbol requires two anchor points. Point 1 defines the tip of the arrowhead and point 2 defines the rear of the symbol. Point 3 defines the 90 degree arc.",
    sizeShape: "Points 1 and 2 are connected by a 90 degree arc. Point 3 indicates on which side of the line the arc is placed.",
    orientation: "The rear of the symbol identifies the enemy’s location and the arrow points in the direction the obstacle should force the enemy to turn.",
  },
  LINE11: {
    anchorPoints: "This symbol requires four points. Points 1 and 2 define one side of the gap and points 3 and 4 define the opposite side of the gap.",
    sizeShape: "",
    orientation: "",
  },
  LINE12: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the symbol and point 3 defines the location of one side of the symbol.",
    sizeShape: "Points 1 and 2 determine the centerline of the symbol and point 3 determines its width.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE13: {
    anchorPoints: "This symbol requires at least two anchor points, points 1 and 2, to define the line. Additional points can be defined to extend the line.",
    sizeShape: "The first and last anchor points determine the length of the line. The size of the tooth does not change.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE14: {
    anchorPoints: "This symbol requires two anchor points. Points 1 and 2 define the tips of the arrowheads.",
    sizeShape: "Points 1 and 2 determine the length of the symbol, which varies only in length. The lines of the arrowhead will form an acute angle.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE16: {
    anchorPoints: "This symbol requires four points. Points 1 and 2 define one side of the assault crossing site and points 3 and 4 define the opposite side of the assault crossing site.",
    sizeShape: "Determined by the anchor points.",
    orientation: "",
  },
  LINE17: {
    anchorPoints: "",
    sizeShape: "Points 1 and 2 determine the length of the symbol. Point 3 determines its width.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE18: {
    anchorPoints: "This symbol requires two anchor points. Points 1 and two define the tips of the arrowheads.",
    sizeShape: "Points 1 and 2 determine the length of the symbol, which varies only in length. The arrowheads will be filled-in versions of a common arrowhead.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE19: {
    anchorPoints: "This symbol requires two anchor points. Points 1 and two define the corners on the front of the symbol.",
    sizeShape: "Points 1 and 2 determine the length of the symbol, which varies only in length.",
    orientation: "Orientation is determined by the anchor points",
  },
  LINE20: {
    anchorPoints: "This graphic requires two anchor points. Point 1 defines the tip of the arrowhead, and point 2 defines the rear of the graphic.",
    sizeShape: "Points 1 and 2 determine the length of the graphic, which varies only in length.",
    orientation: "The arrow points to the location where the convoy has halted.",
  },
  LINE21: {
    anchorPoints: "This symbol requires at least two anchor points to define the line. Additional points can be defined to extend and shape the line.",
    sizeShape: "The first and last anchor points determine the length of the line. The line segment between each pair of anchor points will repeat all information associated with the line segment.",
    orientation: "Orientation is determined by the anchor points.",
  },
  LINE22: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the symbol’s opening and point 3 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the symbol’s height and point 3 determines its length. The vertical line at the rear of the symbol will be the same height as the opening and parallel to it.",
    orientation: "The opening defines the span of the breach and typically faces enemy forces.",
  },
  LINE23: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the symbol’s vertical line and point 3 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the symbol’s height and point 3 determines its length. The spacing between the symbol’s arrows will stay proportional to the symbol’s height. The tip of the middle arrowhead will be at the midpoint of the vertical line. The arrows will stay perpendicular to the vertical line, regardless of the rotational orientation of the symbol as a whole.",
    orientation: "The arrows typically point toward enemy forces.",
  },
  LINE24: {
    anchorPoints: "This symbol requires three anchor points. Point 1 defines the tip of the arrowhead. Point 2 defines the end of the straight line portion of the symbol. Point 3 defines the diameter and orientation of the 180 degree circular arc.",
    sizeShape: "Points 1 and 2 determine the length of the straight line portion of the symbol. Point 3 defines which side of the line the arc is on and the diameter of the arc.",
    orientation: "The arrow points in the direction of the action. The tip of the arrowhead may indicate the location where the action is to conclude. The unit’s current location is typically represented at the base of the arc. The 180 degree circular arc is always perpendicular to the line.",
  },
  LINE25: {
    anchorPoints: "This symbol requires exactly two anchor points. Point 1 defines the tip of the arrowhead and point 2 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the length of the symbol, which varies only in length.",
    orientation: "The arrow typically points in the direction of the action.",
  },
  LINE26: {
    anchorPoints: "Where four points are available Point 1 and Point 2 define the ends of one arrow and Point 3 and Point 4 define the ends of the other arrow. Point 1 and Point 4 define the ends of their respective arrowheads. Where three points are available Point 1 defines the vertex of the symbol. Points 2 and 3 define the tips of the arrowheads.",
    sizeShape: "Where four points are available, Points 1 and 2 and Points 3 and 4 determine the length of the arrows. Where three points are available Points 1 and 2 and points 1 and 3 determine the length of the arrows. The length and orientation of the arrows can vary independently.",
    orientation: "Orientation is determined by the anchor points. The arrowheads may touch other symbols that define the limits of the task. The tactical symbol indicator is centered between point 2 and point 3 when four points are in use or centered on Point 1 when three points are in use.",
  },
  LINE27: {
    anchorPoints: "Where four points are available Point 1 defines the center of the circle. Point 2 defines the radius of the circle. Point 3 defines the curvature of the arc. Point 4 defines the end of the arrow. Where three points are available Point 1 defines the center point of the circle. Point 2 defines the tip of the arrowhead. Point 3 defines the 90 degree arc.",
    sizeShape: "Where four points are available, Points 1 and 2 define the size of the circle, which should be adjusted as needed to contain the unit assigned the task. Point 3 controls the curvature of the arc. Point 4 defines the end of the arrow. Where three points are available Points 1 and 2 are connected by a 90 degree arc. The circle will at least be large enough to accommodate a tactical symbol. Point 3 indicates on which side of the line the arc is placed.",
    orientation: "The arrowhead identifies the location/object to be seized and the circle identifies the unit(s) assigned the task. See 5.3.11 for options to accommodate multiple units.",
  },
  LINE28: {
    anchorPoints: "This symbol requires 2 anchor points. Point 1 defines the tip of the arrowhead, and point 2 defines the rear of the symbol.",
    sizeShape: "Points 1 and 2 determine the length of the symbol, which varies only in length.",
    orientation: "The arrow typically points toward enemy forces with the tip of the arrowhead indicating the location of the action.",
  },
  LINE29: {
    anchorPoints: "This symbol requires three anchor points. Point 1 is the tip of the arrowhead. Points 2 and 3 define the endpoints of the curved line on the back side of the symbol.",
    sizeShape: "Points 2 and 3 determine the length of the curved line on the back side of the symbol. The rear of the arrowhead line shall connect to the midpoint of the line between points 2 and 3. The arrowhead line shall be perpendicular to the line formed by points 2 and 3.",
    orientation: "Orientation is determined by the anchor points. The back side of the symbol encompasses the ambush position, while the arrowhead typically points at the target.",
  },
  LINE30: {
    anchorPoints: "Point 1 defines the tip of the arrowhead. Point 2 defines the end of the symbol. Point 3’s distance from Point 2 defines the length of the four angled lines making up the arrowhead and dashed “tail”. Angles a are always drawn at 45 degrees. Angle b is always drawn at 90 degrees.",
    sizeShape: "The symbol varies only in length.",
    orientation: "",
  },
  LINE31: {
    anchorPoints: "This graphic requires four anchor points. Point 1 defines the beginning of the straight line. Point 2 defines the end of the straight-line portion of the graphic. Point 3 defines the diameter. Point 4 defines the orientation of the 180 degree circular arc.",
    sizeShape: "Points 1 and 2 determine the length of the straight-line portion of the symbol. Point 3 defines the diameter of the arc. Point 4 defines which side of the line the arc is on.",
    orientation: "",
  },
  LINE32: {
    anchorPoints: "This graphic requires three anchor points. Point 1 defines the end of the straight-line portion of the graphic. Point 2 defines the center of the two 90 degree circular arcs. Point 3 defines the tip of the arrowhead.",
    sizeShape: "Points 1 and 3 determine the length of the symbol.",
    orientation: "",
  },
  LINE33: {
    anchorPoints: "This graphic requires three anchor points. Point 1 defines the beginning of the straight line. Point 2 defines the end of the straight line portion of the graphic. Point 3 defines the diameter and orientation of the 180 degree circular arc and the tip of the arrowhead.",
    sizeShape: "Points 1 and 2 determine the length of the straight line portion of the symbol. Point 3 defines which side of the line the arc is on and the diameter of the arc.",
    orientation: "",
  },
  CORRIDOR1: {
    anchorPoints: "This symbol may contain multiple segments. Each segment requires 2 anchor points. Point numbers that define the trace of the segment are sequential beginning with point 1, in increments of 1, up to a max of 99 points. Each anchor point defines the endpoint of a segment’s center line. The anchor points are Air Control Points (ACP), Communications Checkpoints (CCP) or both.",
    sizeShape: "Points 1 and 2 determine the length of a segment. The information field inside each segment should be moveable and scalable within each segment. The information box outside the symbol should be placed between points 1 and 2 in such a way it does not obscure the symbol.",
    orientation: "The anchor points determine orientation.",
  },
  AXIS1: {
    anchorPoints: "The symbol requires N anchor points, where N is between 3 and 50. Point 1 defines the tip of the arrowhead. Point N-1 defines the rear of the symbol. Point N defines the back of the arrowhead. Anchor points are numbered sequentially beginning with point number one (1), in increments of one (1).",
    sizeShape: "Points 1 through N-1 and 2 determine the symbol’s center line and Point N determines the width. The crossover point on the symbol shall occur between Points 1 and 2.",
    orientation: "The arrowhead typically points toward enemy forces.",
  },
  AXIS2: {
    anchorPoints: "The symbol requires N anchor points, where N is between 3 and 50. Point 1 defines the tip of the arrowhead. Point N-1 defines the rear of the symbol. Point N defines the back of the arrowhead. Anchor points are numbered sequentially beginning with point number one (1), in increments of one (1).",
    sizeShape: "Points 1 through N-1 and 2 determine the symbol’s center line and Point N determines the width.",
    orientation: "The arrowhead typically points toward enemy forces.",
  },
  POLYLINE1: {
    anchorPoints: "This symbol requires three anchor points. Points 1 and 2 define the endpoints of the infiltration lane and point 3 defines the width on one side of the lane.",
    sizeShape: "Points 1 and 2 determine the center line of the symbol and point 3 determines the width of the infiltration lane. The rest of the symbol stays proportional to the length of the center line.",
    orientation: "Orientation is determined by points 1 and 2.",
  },
  ELLIPSE1: {
    anchorPoints: "This symbol requires one anchor point. This anchor point represents the center of an ellipse and, therefore, the geographic location of that ellipse.",
    sizeShape: "The size and shape of this symbol is determined by three additional numeric values; A major axis radius, a minor axis radius, and a rotation angle. The radii should be expressed in the appropriate map distance units.",
    orientation: "The orientation of this symbol is determined by the rotation angle provided, where 0 degrees is east/west and a positive rotation angle rotates the ellipse in a counter-clockwise direction.",
  },
  RECTANGULAR1: {
    anchorPoints: "This symbol requires two anchor points and a width, defined in meters, to define the boundary of the area. Points 1 and 2 will be located in the center of two opposing sides of the rectangle.",
    sizeShape: "Size: As determined by the anchor points. The anchor points determine the length of the rectangle. The width, defined in meters, will determine the width of the rectangle. Shape: Rectangle. The information fields should be moveable and scalable.",
    orientation: "As determined by the anchor points.",
  },
  RECTANGULAR2: {
    anchorPoints: "This symbol requires one (1) anchor point to define the center of the area.",
    sizeShape: "Size Is determined by the anchor point, the target length (in meters) and target width (in meters). A rectangular target is wider and longer than 200 meters. The information fields should be moveable and saleable within the area. Shape: Rectangle.",
    orientation: "As determined by the Target Attitude (in mils).",
  },
  RECTANGULAR3: {
    anchorPoints: "This symbol requires one anchor (center) point to define the center of the symbol. The target tactical symbol shall be centered upon the center of the area. The size and the orientation of the target symbol are fixed within the area.",
    sizeShape: "As determined by the anchor points. The anchor points determine the area’s length. Width, determined in meters, will define the width of the rectangle.",
    orientation: "As determined by the anchor points. The center point of the area shall always have the target symbol with the same upright orientation.",
  },
  CIRCULAR1: {
    anchorPoints: "This symbol requires one (1) anchor point and a radius. Point 1 defines the center point of the symbol.",
    sizeShape: "Size: The radius defines the size. Shape: Circle. The information fields should be scalable within the circle.",
    orientation: "Not applicable",
  },
  CIRCULAR2: {
    anchorPoints: "This symbol requires one anchor point that defines an object at a dynamic grid location. This coordinate, which pinpoints the current physical location of a specific unit, weapon or acquisition system, may change with the movement of the object. The symbol for that object is located at the anchor point.",
    sizeShape: "The size is determined by the distance in meters from the object at the center of the range fan. The shapes are concentric circles. A minimum of one (1) and a maximum of three (3) concentric circles can be used.",
    orientation: "The center point is typically centered over the known location of a weapon or sensor system.",
  },
  ARC1: {
    anchorPoints: "This graphic requires one anchor point that defines an object at a dynamic grid location. This coordinate, which pinpoints the current physical location of a specific unit, weapon or sensor system, may change with the movement of the object. The symbol for that object is located at the anchor point.",
    sizeShape: "Determined by the anchor point, azimuths measured from true north, and the distance (range) in meters. The Left Sector Azimuth is the angle measured from true north to the left sector limit/edge of the Sector Range Fan. The Right Sector Azimuth is the angle measured from true north to the right sector limit/edge of the Sector Range Fan. Multiple distances (ranges) and/or left and right sector limits/edges of the sector, as well as altitude, may be added as required to define the sector. All azimuths are in degrees. All distances (ranges) are in meters. All altitudes are in feet.",
    orientation: "The center point is typically centered over the known location of a weapon or sensor system. The orientation may change as the object moves or changes.",
  },
};

export const DRAW_RULE_COUNT = 89;
