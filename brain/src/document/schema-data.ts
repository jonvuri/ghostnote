// Generated from spec/ghostnote-document-v1/schema.json. Owner: 8f2.
export const schema: Record<string, any> = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "urn:ghostnote:document:1.0",
  "title": "Ghostnote Document 1.0",
  "$comment": "Structural checks only. SPEC.md R01-R11 and R25-R34 and FIELDS.md define semantic checks and defaults. No external release is claimed.",
  "oneOf": [
    {
      "$ref": "#/$defs/stateDocument"
    },
    {
      "$ref": "#/$defs/patch"
    }
  ],
  "$defs": {
    "id": {
      "type": "string",
      "pattern": "^[A-Za-z][A-Za-z0-9_.:-]*$",
      "maxLength": 128
    },
    "text": {
      "type": "string",
      "maxLength": 4096
    },
    "label": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4096
    },
    "sha256": {
      "type": "string",
      "pattern": "^[0-9a-f]{64}$"
    },
    "rational": {
      "type": "string",
      "pattern": "^-?(0|[1-9][0-9]{0,95})(/[1-9][0-9]{0,95})?$",
      "maxLength": 194
    },
    "nonnegative": {
      "type": "string",
      "pattern": "^-?0(/[1-9][0-9]{0,95})?$|^[1-9][0-9]{0,95}(/[1-9][0-9]{0,95})?$",
      "maxLength": 194
    },
    "positive": {
      "type": "string",
      "pattern": "^[1-9][0-9]{0,95}(/[1-9][0-9]{0,95})?$",
      "maxLength": 193
    },
    "range": {
      "type": "object",
      "properties": {
        "from": {
          "$ref": "#/$defs/nonnegative"
        },
        "to": {
          "$ref": "#/$defs/positive"
        }
      },
      "required": [
        "from",
        "to"
      ],
      "additionalProperties": false
    },
    "path": {
      "type": "string",
      "minLength": 1,
      "maxLength": 4096
    },
    "provenanceSource": {
      "type": "object",
      "properties": {
        "path": {
          "$ref": "#/$defs/path"
        },
        "sha256": {
          "$ref": "#/$defs/sha256"
        },
        "range": {
          "$ref": "#/$defs/range"
        },
        "read": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/text"
          },
          "additionalProperties": {
            "$ref": "#/$defs/extensionValue"
          }
        },
        "refs": {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/id"
          },
          "additionalProperties": {
            "$ref": "#/$defs/label"
          }
        }
      },
      "required": [
        "path"
      ],
      "additionalProperties": false
    },
    "generator": {
      "type": "object",
      "properties": {
        "path": {
          "$ref": "#/$defs/path"
        },
        "sha256": {
          "$ref": "#/$defs/sha256"
        }
      },
      "required": [
        "path"
      ],
      "additionalProperties": false
    },
    "clipProvenance": {
      "type": "object",
      "properties": {
        "sources": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/provenanceSource"
          },
          "minItems": 1,
          "maxItems": 64,
          "uniqueItems": true
        },
        "generator": {
          "$ref": "#/$defs/generator"
        }
      },
      "required": [],
      "additionalProperties": false,
      "minProperties": 1
    },
    "expression": {
      "type": "object",
      "properties": {
        "velocitySpread": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "gain": {
          "type": "number",
          "minimum": 0,
          "maximum": 8
        },
        "pan": {
          "type": "number",
          "minimum": -1,
          "maximum": 1
        },
        "pressure": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "timbre": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "transpose": {
          "type": "number",
          "minimum": -128,
          "maximum": 128
        }
      },
      "required": [
        "velocitySpread",
        "gain",
        "pan",
        "pressure",
        "timbre",
        "transpose"
      ],
      "additionalProperties": false
    },
    "chance": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "value": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "required": [
        "enabled",
        "value"
      ],
      "additionalProperties": false
    },
    "occurrence": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "condition": {
          "$ref": "#/$defs/label"
        }
      },
      "required": [
        "enabled",
        "condition"
      ],
      "additionalProperties": false
    },
    "recurrence": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "length": {
          "type": "integer",
          "minimum": 1,
          "maximum": 64
        },
        "mask": {
          "type": "integer",
          "minimum": 0,
          "maximum": 9007199254740991
        }
      },
      "required": [
        "enabled",
        "length",
        "mask"
      ],
      "additionalProperties": false
    },
    "repeat": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean"
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "maximum": 128
        },
        "curve": {
          "type": "number",
          "minimum": -1,
          "maximum": 1
        },
        "velocityCurve": {
          "type": "number",
          "minimum": -1,
          "maximum": 1
        },
        "velocityEnd": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      },
      "required": [
        "enabled",
        "count",
        "curve",
        "velocityCurve",
        "velocityEnd"
      ],
      "additionalProperties": false
    },
    "event": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "clip": {
          "$ref": "#/$defs/id"
        },
        "at": {
          "$ref": "#/$defs/nonnegative"
        },
        "duration": {
          "$ref": "#/$defs/positive"
        },
        "pitch": {
          "type": "integer",
          "minimum": 0,
          "maximum": 127
        },
        "velocity": {
          "type": "integer",
          "minimum": 0,
          "maximum": 127
        },
        "channel": {
          "type": "integer",
          "minimum": 1,
          "maximum": 16
        },
        "mute": {
          "type": "boolean"
        },
        "releaseVelocity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "articulation": {
          "$ref": "#/$defs/label"
        },
        "expression": {
          "$ref": "#/$defs/expression"
        },
        "chance": {
          "$ref": "#/$defs/chance"
        },
        "occurrence": {
          "$ref": "#/$defs/occurrence"
        },
        "recurrence": {
          "$ref": "#/$defs/recurrence"
        },
        "repeat": {
          "$ref": "#/$defs/repeat"
        }
      },
      "required": [
        "id",
        "clip",
        "at",
        "duration",
        "pitch",
        "velocity"
      ],
      "additionalProperties": false
    },
    "clipDefaults": {
      "type": "object",
      "properties": {
        "channel": {
          "type": "integer",
          "minimum": 1,
          "maximum": 16
        },
        "mute": {
          "type": "boolean"
        },
        "releaseVelocity": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        },
        "articulation": {
          "$ref": "#/$defs/label"
        },
        "expression": {
          "$ref": "#/$defs/expression"
        },
        "chance": {
          "$ref": "#/$defs/chance"
        },
        "occurrence": {
          "$ref": "#/$defs/occurrence"
        },
        "recurrence": {
          "$ref": "#/$defs/recurrence"
        },
        "repeat": {
          "$ref": "#/$defs/repeat"
        }
      },
      "required": [],
      "additionalProperties": false,
      "minProperties": 1
    },
    "eventSet": {
      "type": "object",
      "properties": {
        "at": {
          "$ref": "#/$defs/nonnegative"
        },
        "duration": {
          "$ref": "#/$defs/positive"
        },
        "pitch": {
          "type": "integer",
          "minimum": 0,
          "maximum": 127
        },
        "velocity": {
          "type": "integer",
          "minimum": 0,
          "maximum": 127
        },
        "channel": {
          "anyOf": [
            {
              "type": "integer",
              "minimum": 1,
              "maximum": 16
            },
            {
              "type": "null"
            }
          ]
        },
        "mute": {
          "anyOf": [
            {
              "type": "boolean"
            },
            {
              "type": "null"
            }
          ]
        },
        "releaseVelocity": {
          "anyOf": [
            {
              "type": "number",
              "minimum": 0,
              "maximum": 1
            },
            {
              "type": "null"
            }
          ]
        },
        "articulation": {
          "anyOf": [
            {
              "$ref": "#/$defs/label"
            },
            {
              "type": "null"
            }
          ]
        },
        "expression": {
          "anyOf": [
            {
              "$ref": "#/$defs/expression"
            },
            {
              "type": "null"
            }
          ]
        },
        "chance": {
          "anyOf": [
            {
              "$ref": "#/$defs/chance"
            },
            {
              "type": "null"
            }
          ]
        },
        "occurrence": {
          "anyOf": [
            {
              "$ref": "#/$defs/occurrence"
            },
            {
              "type": "null"
            }
          ]
        },
        "recurrence": {
          "anyOf": [
            {
              "$ref": "#/$defs/recurrence"
            },
            {
              "type": "null"
            }
          ]
        },
        "repeat": {
          "anyOf": [
            {
              "$ref": "#/$defs/repeat"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [],
      "additionalProperties": false,
      "minProperties": 1
    },
    "eventUpdate": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "set": {
          "$ref": "#/$defs/eventSet"
        }
      },
      "required": [
        "id",
        "set"
      ],
      "additionalProperties": false
    },
    "clip": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "length": {
          "$ref": "#/$defs/nonnegative"
        },
        "name": {
          "$ref": "#/$defs/text"
        },
        "loop": {
          "anyOf": [
            {
              "$ref": "#/$defs/range"
            },
            {
              "type": "null"
            }
          ]
        },
        "playRange": {
          "anyOf": [
            {
              "$ref": "#/$defs/range"
            },
            {
              "type": "null"
            }
          ]
        },
        "provenance": {
          "$ref": "#/$defs/clipProvenance"
        },
        "defaults": {
          "$ref": "#/$defs/clipDefaults"
        }
      },
      "required": [
        "id",
        "length"
      ],
      "additionalProperties": false
    },
    "clipSet": {
      "type": "object",
      "properties": {
        "length": {
          "$ref": "#/$defs/nonnegative"
        },
        "name": {
          "anyOf": [
            {
              "$ref": "#/$defs/text"
            },
            {
              "type": "null"
            }
          ]
        },
        "loop": {
          "anyOf": [
            {
              "$ref": "#/$defs/range"
            },
            {
              "type": "null"
            }
          ]
        },
        "playRange": {
          "anyOf": [
            {
              "$ref": "#/$defs/range"
            },
            {
              "type": "null"
            }
          ]
        },
        "provenance": {
          "anyOf": [
            {
              "$ref": "#/$defs/clipProvenance"
            },
            {
              "type": "null"
            }
          ]
        }
      },
      "required": [],
      "additionalProperties": false,
      "minProperties": 1
    },
    "clipUpdate": {
      "type": "object",
      "properties": {
        "id": {
          "$ref": "#/$defs/id"
        },
        "set": {
          "$ref": "#/$defs/clipSet"
        }
      },
      "required": [
        "id",
        "set"
      ],
      "additionalProperties": false
    },
    "coverage": {
      "type": "object",
      "properties": {
        "clip": {
          "$ref": "#/$defs/id"
        },
        "from": {
          "$ref": "#/$defs/nonnegative"
        },
        "to": {
          "$ref": "#/$defs/nonnegative"
        },
        "channels": {
          "type": "array",
          "items": {
            "type": "integer",
            "minimum": 1,
            "maximum": 16
          },
          "minItems": 1,
          "maxItems": 16,
          "uniqueItems": true
        },
        "fields": {
          "oneOf": [
            {
              "const": "all"
            },
            {
              "type": "array",
              "items": {
                "enum": [
                  "id",
                  "clip",
                  "at",
                  "duration",
                  "pitch",
                  "velocity",
                  "channel",
                  "mute",
                  "releaseVelocity",
                  "articulation",
                  "expression",
                  "chance",
                  "occurrence",
                  "recurrence",
                  "repeat"
                ]
              },
              "minItems": 8,
              "maxItems": 15,
              "uniqueItems": true
            }
          ]
        },
        "status": {
          "enum": [
            "complete",
            "partial",
            "unavailable"
          ]
        },
        "reason": {
          "$ref": "#/$defs/label"
        }
      },
      "required": [
        "clip",
        "from",
        "to",
        "channels",
        "fields",
        "status"
      ],
      "additionalProperties": false,
      "allOf": [
        {
          "if": {
            "properties": {
              "status": {
                "enum": [
                  "partial",
                  "unavailable"
                ]
              }
            }
          },
          "then": {
            "required": [
              "reason"
            ]
          }
        }
      ]
    },
    "meta": {
      "type": "object",
      "properties": {
        "title": {
          "$ref": "#/$defs/text"
        },
        "description": {
          "$ref": "#/$defs/text"
        },
        "permission": {
          "$ref": "#/$defs/text"
        }
      },
      "required": [],
      "additionalProperties": false
    },
    "base": {
      "type": "object",
      "properties": {
        "sha256": {
          "$ref": "#/$defs/sha256"
        },
        "ref": {
          "$ref": "#/$defs/label"
        }
      },
      "required": [
        "sha256"
      ],
      "additionalProperties": false
    },
    "extensionValue": {
      "oneOf": [
        {
          "type": "null"
        },
        {
          "type": "boolean"
        },
        {
          "type": "number"
        },
        {
          "$ref": "#/$defs/text"
        },
        {
          "type": "array",
          "items": {
            "$ref": "#/$defs/extensionValue"
          },
          "minItems": 0
        },
        {
          "type": "object",
          "propertyNames": {
            "$ref": "#/$defs/text"
          },
          "additionalProperties": {
            "$ref": "#/$defs/extensionValue"
          }
        }
      ]
    },
    "extensions": {
      "type": "object",
      "propertyNames": {
        "allOf": [
          {
            "$ref": "#/$defs/id"
          },
          {
            "pattern": ":"
          }
        ]
      },
      "additionalProperties": {
        "$ref": "#/$defs/extensionValue"
      }
    },
    "stateDocument": {
      "type": "object",
      "properties": {
        "format": {
          "const": "ghostnote-document"
        },
        "version": {
          "const": "1.0"
        },
        "kind": {
          "enum": [
            "snapshot",
            "desired"
          ]
        },
        "meta": {
          "$ref": "#/$defs/meta"
        },
        "base": {
          "$ref": "#/$defs/base"
        },
        "extensions": {
          "$ref": "#/$defs/extensions"
        },
        "clips": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/clip"
          },
          "minItems": 0,
          "maxItems": 256
        },
        "coverage": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/coverage"
          },
          "minItems": 0,
          "maxItems": 256
        },
        "events": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/event"
          },
          "minItems": 0,
          "maxItems": 131072
        }
      },
      "required": [
        "format",
        "version",
        "kind",
        "clips",
        "coverage",
        "events"
      ],
      "additionalProperties": false,
      "allOf": [
        {
          "if": {
            "properties": {
              "kind": {
                "const": "snapshot"
              }
            }
          },
          "then": {
            "not": {
              "required": [
                "base"
              ]
            }
          }
        }
      ]
    },
    "patch": {
      "type": "object",
      "properties": {
        "format": {
          "const": "ghostnote-document"
        },
        "version": {
          "const": "1.0"
        },
        "kind": {
          "const": "patch"
        },
        "meta": {
          "$ref": "#/$defs/meta"
        },
        "base": {
          "$ref": "#/$defs/base"
        },
        "extensions": {
          "$ref": "#/$defs/extensions"
        },
        "add": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/event"
          },
          "minItems": 0,
          "maxItems": 131072
        },
        "remove": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/id"
          },
          "minItems": 0,
          "maxItems": 131072,
          "uniqueItems": true
        },
        "update": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/eventUpdate"
          },
          "minItems": 0,
          "maxItems": 131072
        },
        "clipUpdate": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/clipUpdate"
          },
          "minItems": 0,
          "maxItems": 256
        }
      },
      "required": [
        "format",
        "version",
        "kind",
        "base",
        "add",
        "remove",
        "update",
        "clipUpdate"
      ],
      "additionalProperties": false
    }
  }
};
