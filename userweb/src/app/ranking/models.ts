export const models = {
  'Trouble Analyzer': {
    'explanation': 'We estimate the following issues to be the causes for your RE project\'s trouble.',
    'generic_categories': {
      'PROBLEMS_CODE': 'Observed Problems',
      'EFFECTS_CODE': 'Observed Effects'
    },
    'model': {
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
    },
    'validation': null
  },
  'Trouble Predictor': {
    'explanation': 'You are likely to encounter the following problems during your RE project.',
    'generic_categories': {
      'EFFECTS_CODE': 'Observed Effects',
      'CAUSES_CODE': 'Observed Causes'
    },
    'model': {
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
    },
    'validation': {"napire.Metrics.binary_accuracy":{"limits":[0,1],"data_xlabel":"Node-present threshold","data":[{"config":0.1,"value":0.47234375,"baseline":0.34453125,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.2,"value":0.7621875,"baseline":0.56390625,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.3,"value":0.8240625,"baseline":0.69796875,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.4,"value":0.84421875,"baseline":0.73765625,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.5,"value":0.8465625,"baseline":0.75890625,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.6,"value":0.84421875,"baseline":0.76359375,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.7,"value":0.84171875,"baseline":0.76359375,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.8,"value":0.83484375,"baseline":0.76359375,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555},{"config":0.9,"value":0.83453125,"baseline":0.76359375,"value_average":0.7894097222222223,"baseline_average":0.6841493055555555}]},"napire.Metrics.ranking":{"limits":[0,1],"data_xlabel":"Considered elements at the top of the list","data":[{"config":1,"value":0.23066754791804361,"baseline":0.12888301387970919,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":2,"value":0.4077990746860542,"baseline":0.2452081956378057,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":3,"value":0.5340383344348976,"baseline":0.34236615994712494,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":4,"value":0.6146728354263054,"baseline":0.42233972240581624,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":5,"value":0.6920026437541309,"baseline":0.5234633179114342,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":6,"value":0.7402511566424322,"baseline":0.5955056179775281,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":7,"value":0.797752808988764,"baseline":0.6470588235294118,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":8,"value":0.845340383344349,"baseline":0.7091870456047588,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397},{"config":9,"value":0.8830138797091871,"baseline":0.767349636483807,"value_average":0.6383931849893516,"baseline_average":0.48681794815304397}]},"napire.Metrics.brier_score":{"limits":[0,1],"data":[{"config":null,"value":0.11368882062500005,"baseline":0.1666485834730342,"value_average":0.11368882062500005,"baseline_average":0.1666485834730342}]},"napire.Metrics.recall":{"limits":[0,1],"data_xlabel":"Node-present threshold","data":[{"config":0.1,"value":0.9557171183079973,"baseline":0.9643093192333113,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.2,"value":0.7250495703899538,"baseline":0.767349636483807,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.3,"value":0.5988103106411103,"baseline":0.5155320555188367,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.4,"value":0.5023132848645075,"baseline":0.33509583608724386,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.5,"value":0.4150693985459352,"baseline":0.016523463317911435,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.6,"value":0.3668208856576338,"baseline":0,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.7,"value":0.34038334434897555,"baseline":0,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.8,"value":0.30138797091870456,"baseline":0,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456},{"config":0.9,"value":0.30006609385327165,"baseline":0,"value_average":0.5006242197253433,"baseline_average":0.2887567011823456}]},"napire.Metrics.precision":{"limits":[0,1],"data_xlabel":"Node-present threshold","data":[{"config":0.1,"value":0.30403700588730026,"baseline":0.3067703952901598,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.2,"value":0.4979573309123922,"baseline":0.5270086246028144,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.3,"value":0.6357894736842106,"baseline":0.5473684210526316,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.4,"value":0.7569721115537849,"baseline":0.5049800796812749,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.5,"value":0.8662068965517241,"baseline":0.034482758620689655,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.6,"value":0.9343434343434344,"baseline":0,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.7,"value":0.9716981132075472,"baseline":0,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.8,"value":1,"baseline":0,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894},{"config":0.9,"value":1,"baseline":0,"value_average":0.7741115962378214,"baseline_average":0.21340114213861894}]}}
  }
}
