#!/usr/bin/env python3
"""Check the 9a layout design on scalar models. Do not read or call the host."""
import itertools
import json


def layout(rectangles):
    """Model the pinned llL pass. The final rectangle is the inserted module."""
    last = len(rectangles) - 1
    order = sorted(range(len(rectangles)),
                   key=lambda i: (rectangles[i][0], i != last, rectangles[i][1]))
    low = min(r[1] for r in rectangles)
    high = max(r[1] + r[3] for r in rectangles)
    assert 0 < high - low <= 16
    edges = [-2**31] * (high - low)
    result = list(rectangles)
    for i in order:
        x, y, w, h = rectangles[i]
        x = max(x, *edges[y - low:y + h - low])
        result[i] = (x, y, w, h)
        edges[y - low:y + h - low] = [x + w] * h
    return result


def overlaps(a, b):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return ax < bx + bw and bx < ax + aw and ay < by + bh and by < ay + ah


def main():
    admitted = refused = 0
    # These dimensions are hypotheses, not observed native dimensions.
    # All three Amplify modules use the same hypothetical dimensions here.
    for sw, sh, aw, ah, ow, oh in itertools.product(range(1, 9), repeat=6):
        rectangles = [(-4, -2, sw, sh), (-1, -2, aw, ah),
                      (0, -2, ow, oh), (-1, 0, aw, ah), (2, 0, aw, ah)]
        if any(overlaps(a, b) for a, b in itertools.combinations(rectangles, 2)):
            refused += 1
            continue
        assert layout(rectangles) == rectangles
        admitted += 1
    # The inserted module wins an x tie. Touching edges do not overlap.
    assert layout([(0, 0, 1, 1), (0, 0, 1, 1)]) == [(1, 0, 1, 1), (0, 0, 1, 1)]
    assert not overlaps((-1, -2, 1, 2), (0, -2, 2, 2))
    assert layout([(-16, -16, 8, 8), (-8, -8, 8, 8)]) == [(-16, -16, 8, 8), (-8, -8, 8, 8)]
    try:
        layout([(0, -16, 1, 1), (2, 0, 1, 1)])
    except AssertionError:
        pass
    else:
        raise AssertionError("The 17-row case must fail before allocation")
    print(json.dumps({
        "scope": "Offline scalar hypotheses; no live rectangle or native layout proof",
        "dimensionCombinations": admitted + refused,
        "admittedWithNoMovement": admitted,
        "refusedOverlap": refused,
        "boundaryChecks": ["inserted-first tie", "half-open edge contact",
                           "negative origin and 16-row span", "17-row refusal"],
        "limitation": "The probe must read every native rectangle independently; unequal Amplify dimensions and integer overflow need implementation tests."
    }, indent=2))


if __name__ == "__main__":
    main()
