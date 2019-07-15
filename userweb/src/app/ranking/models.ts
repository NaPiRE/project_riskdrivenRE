export const models = {
  'Cause analyzer': {
    'generic_categories': {
      'PROBLEMS_CODE': 'Observed Problems',
      'EFFECTS_CODE': 'Observed Effects'
    }, 'model': {
      "dataset": "napire.DataSets.nap_2018",
      "nodes": [
        {
          "node_type": "CAUSES_CODE",
          "filter": 45,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_DEV",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_DISTRIBUTED",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_SIZE",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_SYSTEM",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "EFFECTS_CODE",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "PROBLEMS_CODE",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "RELATIONSHIP",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        }
      ],
      "connect": [
        {
          "from": "RELATIONSHIP",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_SIZE",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_DISTRIBUTED",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_DEV",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "EFFECTS_CODE",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "PROBLEMS_CODE",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        }
      ],
      "query": [
        "CAUSES_CODE_42",
        "CAUSES_CODE_112",
        "CAUSES_CODE_65",
        "CAUSES_CODE_02",
        "CAUSES_CODE_85",
        "CAUSES_CODE_118",
        "CAUSES_CODE_37",
        "CAUSES_CODE_115",
        "CAUSES_CODE_55",
        "CAUSES_CODE_39",
        "CAUSES_CODE_99",
        "CAUSES_CODE_89",
        "CAUSES_CODE_93",
        "CAUSES_CODE_46",
        "CAUSES_CODE_25",
        "CAUSES_CODE_14",
        "CAUSES_CODE_100",
        "CAUSES_CODE_88",
        "CAUSES_CODE_69",
        "CAUSES_CODE_48",
        "CAUSES_CODE_68"
      ],
      "evidence": {},
      "inference_method": ""
    }
  },
  'Trouble predictor': {
    'generic_categories': {
      'PROBLEMS_CODE': 'Observed Problems',
      'EFFECTS_CODE': 'Observed Effects'
    }, 'model': {
      "dataset": "napire.DataSets.nap_2018",
      "nodes": [
        {
          "node_type": "CAUSES_CODE",
          "filter": 45,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_DEV",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_DISTRIBUTED",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_SIZE",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "CONTEXT_SYSTEM",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "EFFECTS_CODE",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "PROBLEMS_CODE",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        },
        {
          "node_type": "RELATIONSHIP",
          "filter": 5,
          "weighted_filter": true,
          "absent_is_unknown": false
        }
      ],
      "connect": [
        {
          "from": "RELATIONSHIP",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_SIZE",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_DISTRIBUTED",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_DEV",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "EFFECTS_CODE",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "PROBLEMS_CODE",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        }
      ],
      "query": [
        "CAUSES_CODE_42",
        "CAUSES_CODE_112",
        "CAUSES_CODE_65",
        "CAUSES_CODE_02",
        "CAUSES_CODE_85",
        "CAUSES_CODE_118",
        "CAUSES_CODE_37",
        "CAUSES_CODE_115",
        "CAUSES_CODE_55",
        "CAUSES_CODE_39",
        "CAUSES_CODE_99",
        "CAUSES_CODE_89",
        "CAUSES_CODE_93",
        "CAUSES_CODE_46",
        "CAUSES_CODE_25",
        "CAUSES_CODE_14",
        "CAUSES_CODE_100",
        "CAUSES_CODE_88",
        "CAUSES_CODE_69",
        "CAUSES_CODE_48",
        "CAUSES_CODE_68"
      ],
      "evidence": {},
      "inference_method": ""
    }
  }
}
