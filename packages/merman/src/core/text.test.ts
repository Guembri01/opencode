import { describe, expect, test } from "bun:test"
import { diagramTextWidth, measureDiagramTextBox, parseDiagramTextLines, splitDiagramLines } from "./text.js"

describe("diagram text helpers", () => {
  test("splits Mermaid-style line breaks", () => {
    expect(splitDiagramLines("one<br/> two <br>three")).toEqual(["one", "two", "three"])
  })

  test("splits labels on the \\n escape and on raw newlines", () => {
    // Mermaid renders `\n` inside a label as a line break, and a label written across lines means the same (#66773).
    expect(splitDiagramLines("Service A\\nLine 2<BR />Line 3")).toEqual(["Service A", "Line 2", "Line 3"])
    expect(splitDiagramLines("first\nsecond\r\nthird")).toEqual(["first", "second", "third"])
    expect(parseDiagramTextLines("<b>Service A</b>\\n<strong>Line 2</strong>")).toEqual([
      { text: "Service A", runs: [{ text: "Service A", italic: false, bold: true }] },
      { text: "Line 2", runs: [{ text: "Line 2", italic: false, bold: true }] },
    ])
  })

  test("extracts Mermaid italic markup from visible text", () => {
    expect(parseDiagramTextLines("plain <i>italic</i><br/><em>again</em>")).toEqual([
      {
        text: "plain italic",
        runs: [
          { text: "plain ", italic: false, bold: false },
          { text: "italic", italic: true, bold: false },
        ],
      },
      { text: "again", runs: [{ text: "again", italic: true, bold: false }] },
    ])
  })

  test("extracts Mermaid bold markup and nests it with italics", () => {
    expect(parseDiagramTextLines("<b>Service A</b> and <strong><i>both</i></STRONG>")).toEqual([
      {
        text: "Service A and both",
        runs: [
          { text: "Service A", italic: false, bold: true },
          { text: " and ", italic: false, bold: false },
          { text: "both", italic: true, bold: true },
        ],
      },
    ])
  })

  test("measures padded text boxes", () => {
    expect(measureDiagramTextBox("wide<br/>x", { paddingX: 2, paddingY: 1 })).toEqual({
      width: 8,
      height: 4,
      lines: ["wide", "x"],
    })
  })

  test("measures terminal cell width", () => {
    expect(diagramTextWidth("abc")).toBe(3)
  })
})
