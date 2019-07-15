export const models = {
  'Trouble Analyzer': {
    'explanation': 'We estimate the following issues to be the causes for your RE project\'s trouble.',
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
      ]
    }
  },
  'Trouble Predictor': {
    'explanation': 'You are likely to encounter the following problems during your RE project.',
    'generic_categories': {
      'PROBLEMS_CODE': 'Observed Problems',
      'CAUSES_CODE': 'Observed Causes'
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
          "from": "CONTEXT_SIZE",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_DISTRIBUTED",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "CONTEXT_DEV",
          "to": "CAUSES_CODE",
          "filter": 10,
          "weighted_filter": true
        },
        {
          "from": "EFFECTS_CODE",
          "to": "PROBLEMS_CODE",
          "filter": 15,
          "weighted_filter": true
        },
        {
          "from": "CAUSES_CODE",
          "to": "PROBLEMS_CODE",
          "filter": 10,
          "weighted_filter": true
        }
      ],
      "query": [
        "PROBLEMS_CODE_19",
        "PROBLEMS_CODE_02",
        "PROBLEMS_CODE_15",
        "PROBLEMS_CODE_14",
        "PROBLEMS_CODE_10",
        "PROBLEMS_CODE_16",
        "PROBLEMS_CODE_01",
        "PROBLEMS_CODE_09",
        "PROBLEMS_CODE_11",
        "PROBLEMS_CODE_13",
        "PROBLEMS_CODE_05",
        "PROBLEMS_CODE_07",
        "PROBLEMS_CODE_20",
        "PROBLEMS_CODE_06",
        "PROBLEMS_CODE_18",
        "PROBLEMS_CODE_08"
      ]
    }
  }
}
