import { Component, isDevMode } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, ActivationEnd, Router } from '@angular/router';

import { ImageComponent } from '../image/image.component';
import { MatDialog } from '@angular/material/dialog';

import { Observable, of, timer, throwError, zip } from 'rxjs';
import { catchError, map, flatMap, filter, retry, tap } from 'rxjs/operators';
@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss']
})
export class RankingComponent {

  private MAX_ITEMS = 5;

  private errorHandler = err => {
    let p = new URL(err.url).pathname
    if(isDevMode() && this.fallback_data[p]) {
      return timer(1000).pipe(map(t => this.fallback_data[p]));
    } else {
      alert("Request to " + p + " failed: " + err.statusText + " (" + err.status + ")");
      return throwError(err);
    }
  };

  constructor(private http: HttpClient, private dialog: MatDialog, private activatedRoute: ActivatedRoute, private router: Router, private sanitizer: DomSanitizer) {
    http.post("/descriptions", this.model).pipe(
      catchError(this.errorHandler),
      map(descriptions => {
        this.descriptions = descriptions;
        for(let c in this.generic_categories) {
          this.descriptions[c] = this.generic_categories[c];
        }
      }),
      flatMap(descriptions => http.post("/items", this.model).pipe(
        catchError(this.errorHandler)
      )),
      map(items => {
        // remove NotCodable, sort generic categories by description
        for(let c in this.generic_categories) {
          items.items[c] = items.items[c].filter(it => this.descriptions[it] != "NotCodable");

          items.items[c].sort( (f1, f2) => this.descriptions[f1].localeCompare(this.descriptions[f2]) );
        }

        // sort others by  their item id
        for(let c in items.items) {
          if(this.generic_categories[c]) {
            continue;
          }
          items.items[c].sort( (f1, f2) => f1.localeCompare(f2) );
        }
        this.items = items;

      })
    ).subscribe(data => {
      this.loaded = true;
    });

    this.activatedRoute.queryParams.pipe(
      map(params => params['id']),
      tap(taskId => this.running = true),
      flatMap(taskId => !taskId ? of({ 'state': 'NOTASK' }) : this.http.get('/tasks?printresult=true&id=' + taskId).pipe(
            catchError(err => {
              if(err.status == 404 && !isDevMode()) {
                return of({ 'state': 'NOTASK' });
              }

              return this.errorHandler(err);
            }),
            flatMap(result => (result.state == 'RUNNING') ? timer(1000).pipe(flatMap(t => throwError('RUNNING'))) : of(result)),
            retry())
      ),
      catchError(err => {
        return of({ 'state': 'FAILED', 'result': err });
      })
    ).subscribe(result => {
      this.running = false;

      if(result.state == 'FAILED') {
        this.result = null;
        this.plot = null;
      } else if(result.state == 'NOTASK') {
        this.router.navigate( [ ], { relativeTo: this.activatedRoute, queryParams: {} });
        return;
      }

      this.plot = this.sanitizer.bypassSecurityTrustUrl(result.result.plot);
      result = Object.entries(result.result.data);
      result.sort( (r1, r2) => r2[1] - r1[1] );
      this.result = [];
      this.shortresult = [];
      for(let i = 0; i < result.length; i++) {
        let val = [ i + 1, this.descriptions[result[i][0]], Math.round(result[i][1] * 100) ];
        this.result.push(val);
        if(i < this.MAX_ITEMS) {
          this.shortresult.push(val);
        }
      }
    });
  }

  model = {"dataset":"napire.DataSets.nap_2018","nodes":[{"node_type":"CAUSES_CODE","filter":45,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"CONTEXT_DEV","filter":5,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"CONTEXT_DISTRIBUTED","filter":5,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"CONTEXT_SIZE","filter":5,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"CONTEXT_SYSTEM","filter":5,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"EFFECTS_CODE","filter":5,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"PROBLEMS_CODE","filter":5,"weighted_filter":true,"absent_is_unknown":false},{"node_type":"RELATIONSHIP","filter":5,"weighted_filter":true,"absent_is_unknown":false}],"connect":[{"from":"RELATIONSHIP","to":"PROBLEMS_CODE","filter":10,"weighted_filter":true},{"from":"CONTEXT_SIZE","to":"PROBLEMS_CODE","filter":10,"weighted_filter":true},{"from":"CONTEXT_DISTRIBUTED","to":"PROBLEMS_CODE","filter":10,"weighted_filter":true},{"from":"CONTEXT_DEV","to":"PROBLEMS_CODE","filter":10,"weighted_filter":true},{"from":"EFFECTS_CODE","to":"CAUSES_CODE","filter":10,"weighted_filter":true},{"from":"PROBLEMS_CODE","to":"CAUSES_CODE","filter":10,"weighted_filter":true}],"query":["CAUSES_CODE_42","CAUSES_CODE_112","CAUSES_CODE_65","CAUSES_CODE_02","CAUSES_CODE_85","CAUSES_CODE_118","CAUSES_CODE_37","CAUSES_CODE_115","CAUSES_CODE_55","CAUSES_CODE_39","CAUSES_CODE_99","CAUSES_CODE_89","CAUSES_CODE_93","CAUSES_CODE_46","CAUSES_CODE_25","CAUSES_CODE_14","CAUSES_CODE_100","CAUSES_CODE_88","CAUSES_CODE_69","CAUSES_CODE_48","CAUSES_CODE_68"],"evidence":{},"inference_method":""}

  descriptions:any = null;
  items:any = null;
  loaded:boolean = false;
  running:boolean = false;

  showall:boolean = false;
  result:any = null;
  plot:any = null;
  shortresult:any = null;

  evidence = {};

  sliderDisplayWith() {
      return (slider_val) => slider_val < 0 ? '?' : this.descriptions['CONTEXT_SIZE_' + slider_val.toString().padStart(2, '0')];
  }

  setEvidence(item, value) {
    if(value) {
      this.evidence[item] = true;
    } else if(this.evidence[item]) {
      delete this.evidence[item];
    }
  }

  setExclusiveEvidence(category, exclusive_item, absent_value) {
    for(let item of this.items.items[category]) {
      this.evidence[item] = item == exclusive_item ? true : absent_value;
    }
  }

  setSliderEvidence(slider_val) {
    if(slider_val < 0) {
      this.setExclusiveEvidence('CONTEXT_SIZE', '', undefined);
      return;
    }

    let item = 'CONTEXT_SIZE_' + slider_val.toString().padStart(2, '0');
    this.setExclusiveEvidence('CONTEXT_SIZE', item, false);
  }

  run() {
    let query_dict = Object.assign({}, this.model);
    query_dict['inference_method'] = 'BayesNets.GibbsSamplingFull';
    query_dict['plot'] = true;
    query_dict['timeout'] = 0.1;
    this.running = true;

    this.http.post('/infer', query_dict).pipe(
        catchError(this.errorHandler)
    ).subscribe(taskId => {
      if(this.activatedRoute.snapshot.queryParams['id'] == taskId) {
        this.running = false;
        return;
      }

      this.router.navigate([ ], { relativeTo: this.activatedRoute, queryParams: { 'id': taskId } });
    });
  }

  showFullImage() {
    this.dialog.open(ImageComponent, { "data": this.plot, height: '80%', width: '80%' });
  }

  private generic_categories = {
    'PROBLEMS_CODE': 'Observed Problems',
    'EFFECTS_CODE': 'Observed Effects'
  };

  private fallback_data = {

  "/descriptions": {
      "CAUSES_CODE_42": "Lack of experience of RE team members",
      "EFFECTS_CODE_42": "Poor product quality",
      "CAUSES_CODE_116": "Volatile requirements",
      "EFFECTS_CODE_04": "Conflicts within the team",
      "PROBLEMS_CODE_10": "Moving targets (changing goals, business processes and / or requirements)",
      "CAUSES_CODE_85": "NotCodable",
      "CAUSES_CODE_115": "Volatile industry segment that leads to changes",
      "EFFECTS_CODE_16": "Incomplete Requirements",
      "EFFECTS_CODE_22": "Increased maintenance costs",
      "CONTEXT_SIZE_00": "1-5",
      "EFFECTS_CODE_07": "Decreased efficiency (overall)",
      "CONTEXT_DEV_CODE_01": "Rather agile",
      "CAUSES_CODE_118": "Weak qualification of RE team members",
      "CONTEXT_DEV_CODE_00": "Agile",
      "EFFECTS_CODE_43": "Poor requirements quality (general)",
      "EFFECTS_CODE_18": "Increased communication",
      "PROBLEMS_CODE_04": "Gold plating (implementation of features without corresponding requirements)",
      "EFFECTS_CODE_38": "Overall demotivation",
      "PROBLEMS_CODE_13": "Terminological problems",
      "CAUSES_CODE_48": "Lack of time",
      "EFFECTS_CODE_49": "Time overrun",
      "CAUSES_CODE_65": "Missing customer involvement",
      "CONTEXT_SYSTEM_02": "Hybrid of both software-intensive embedded systems and business information systems",
      "EFFECTS_CODE_40": "Poor communication",
      "CONTEXT_SYSTEM_01": "Business information systems",
      "CAUSES_CODE_46": "Lack of requirements management",
      "EFFECTS_CODE_21": "Increased difficulty of requirements elicitation",
      "CONTEXT_DISTRIBUTED_00": "Distributed project",
      "PROBLEMS_CODE_07": "Insufficient support by customer",
      "PROBLEMS_CODE_20": "Weak relationship between customer and project lead",
      "CONTEXT_DEV_CODE_04": "Plan-driven",
      "CAUSES_CODE_68": "Missing domain knowledge",
      "CAUSES_CODE_44": "Lack of leadership",
      "CAUSES_CODE_56": "Missing RE awareness at customer side",
      "PROBLEMS_CODE_02": "Communication flaws within the project team",
      "CONTEXT_SIZE_02": "15-30",
      "CAUSES_CODE_89": "Poor requirements elicitation techniques",
      "EFFECTS_CODE_37": "NotCodable",
      "PROBLEMS_CODE_19": "Weak knowledge about customer's application domain",
      "CAUSES_CODE_08": "Conflict of interests at customer side",
      "CAUSES_CODE_37": "Lack of a well-defined RE process",
      "EFFECTS_CODE_15": "Implementation of irrelevant requirements",
      "PROBLEMS_CODE_14": "Time boxing / Not enough time in general",
      "EFFECTS_CODE_05": "Customer dissatisfaction",
      "CAUSES_CODE_93": "Requirements remain too abstract",
      "CAUSES_CODE_14": "Customer does not know what he wants",
      "CAUSES_CODE_112": "Unclear terminology",
      "CAUSES_CODE_55": "Missing IT project experience at customer side",
      "PROBLEMS_CODE_09": "Missing traceability",
      "CAUSES_CODE_25": "Incomplete requirements",
      "CONTEXT_DEV_CODE_02": "Hybrid",
      "CAUSES_CODE_108": "Unclear business needs",
      "CAUSES_CODE_06": "Complexity of project",
      "CAUSES_CODE_30": "Insufficient information",
      "PROBLEMS_CODE_18": "Weak access to customer needs and / or (internal) business information",
      "CONTEXT_SIZE_03": "31-70",
      "CONTEXT_DEV_CODE_03": "Rather plan-driven",
      "EFFECTS_CODE_28": "Inneficient development",
      "EFFECTS_CODE_36": "Need for support by a more experienced developer",
      "EFFECTS_CODE_14": "Effort overrun",
      "PROBLEMS_CODE_03": "Discrepancy between high degree of innovation and need for formal acceptance of (potentially wrong / incomplete / unknown) requirements",
      "EFFECTS_CODE_23": "Increased number of change requests",
      "EFFECTS_CODE_02": "Conflicts with the customer",
      "PROBLEMS_CODE_16": "Underspecified requirements that are too abstract and allow for various interpretations",
      "PROBLEMS_CODE_01": "Communication flaws between the project and the customer",
      "CAUSES_CODE_99": "Stakeholders lack business vision and understanding",
      "PROBLEMS_CODE_05": "Incomplete or hidden requirements",
      "EFFECTS_CODE_13": "Difficulties in project management",
      "CONTEXT_SIZE_05": "141-",
      "CAUSES_CODE_29": "Insufficient collaboration in process",
      "EFFECTS_CODE_01": "Budget overrun",
      "PROBLEMS_CODE_11": "Stakeholders with difficulties in separating requirements from previously known solution designs",
      "PROBLEMS_CODE_12": "Technically unfeasible requirements",
      "EFFECTS_CODE_44": "Project scope becomes unclear",
      "CONTEXT_SIZE_01": "6-14",
      "EFFECTS_CODE_35": "Misunderstanding (overall)",
      "CAUSES_CODE_88": "Poor project management",
      "PROBLEMS_CODE_06": "Inconsistent requirements",
      "PROBLEMS_CODE_08": "Insufficient support by project lead",
      "CAUSES_CODE_69": "Missing engagement by customer",
      "CAUSES_CODE_47": "Lack of teamwork skills",
      "CAUSES_CODE_38": "Lack of change management at customer side",
      "CAUSES_CODE_02": "Communication flaws between team and customer",
      "PROBLEMS_CODE_15": "Unclear / unmeasurable non-functional requirements",
      "CAUSES_CODE_100": "Strict time schedule by customer",
      "EFFECTS_CODE_39": "Poor (system) design quality",
      "EFFECTS_CODE_52": "Validation of requirements becomes difficult",
      "CONTEXT_SIZE_04": "71-140",
      "CONTEXT_SYSTEM_00": "Software-intensive embedded systems",
      "CAUSES_CODE_39": "Lack of communication channels",
      "EFFECTS_CODE_26": "Inefficient development"
  },

  "/items": {
      "edges": {
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_29": 7,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_42": 12,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_93": 11,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_93": 8,
          ":EFFECTS_CODE_43 => :CAUSES_CODE_14": 13,
          ":CONTEXT_SIZE_05 => :CAUSES_CODE_02": 6,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_29": 8,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_69": 8,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_88": 118,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_37": 15,
          ":PROBLEMS_CODE_08 => :CAUSES_CODE_88": 12,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_38": 19,
          ":EFFECTS_CODE_37 => :CAUSES_CODE_48": 9,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_42": 56,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_30": 8,
          ":PROBLEMS_CODE_20 => :CAUSES_CODE_39": 11,
          ":EFFECTS_CODE_43 => :CAUSES_CODE_48": 13,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_65": 26,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_115": 13,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_37": 32,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_69": 15,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_02": 18,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_02": 20,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_47": 6,
          ":PROBLEMS_CODE_08 => :CAUSES_CODE_69": 9,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_89": 22,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_48": 6,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_30": 16,
          ":PROBLEMS_CODE_07 => :CAUSES_CODE_47": 6,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_29": 8,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_85": 18,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_25": 12,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_88": 132,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_115": 20,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_42": 27,
          ":PROBLEMS_CODE_07 => :CAUSES_CODE_69": 12,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_68": 6,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_14": 16,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_99": 10,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_68": 8,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_108": 34,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_46": 15,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_08": 7,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_65": 49,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_47": 17,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_112": 36,
          ":CONTEXT_SIZE_04 => :CAUSES_CODE_42": 14,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_89": 27,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_118": 11,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_99": 32,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_29": 12,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_29": 8,
          ":EFFECTS_CODE_38 => :CAUSES_CODE_02": 5,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_55": 5,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_38": 10,
          ":PROBLEMS_CODE_20 => :CAUSES_CODE_02": 5,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_37": 6,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_108": 12,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_42": 38,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_25": 16,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_55": 13,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_69": 6,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_99": 13,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_115": 9,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_65": 6,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_65": 7,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_100": 9,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_115": 5,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_100": 11,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_68": 25,
          ":PROBLEMS_CODE_11 => :CAUSES_CODE_37": 28,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_93": 5,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_14": 47,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_108": 8,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_68": 29,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_14": 8,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_85": 17,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_42": 22,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_89": 20,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_30": 6,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_14": 8,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_85": 14,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_02": 59,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_93": 5,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_65": 57,
          ":EFFECTS_CODE_16 => :CAUSES_CODE_68": 6,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_116": 22,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_48": 12,
          ":EFFECTS_CODE_28 => :CAUSES_CODE_93": 6,
          ":EFFECTS_CODE_07 => :CAUSES_CODE_42": 6,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_48": 75,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_118": 17,
          ":PROBLEMS_CODE_19 => :CAUSES_CODE_99": 12,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_02": 63,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_69": 6,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_118": 9,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_08": 6,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_108": 24,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_88": 18,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_47": 8,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_14": 29,
          ":EFFECTS_CODE_18 => :CAUSES_CODE_112": 12,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_99": 14,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_39": 19,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_68": 52,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_69": 10,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_89": 14,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_115": 10,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_88": 53,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_06": 6,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_100": 5,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_108": 6,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_115": 15,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_55": 6,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_115": 5,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_44": 6,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_39": 6,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_37": 10,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_42": 35,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_47": 14,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_55": 33,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_93": 7,
          ":PROBLEMS_CODE_12 => :CAUSES_CODE_55": 7,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_55": 21,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_99": 26,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_38": 9,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_89": 24,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_112": 6,
          ":PROBLEMS_CODE_09 => :CAUSES_CODE_37": 14,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_39": 6,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_39": 10,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_85": 17,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_14": 17,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_29": 12,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_29": 31,
          ":CONTEXT_SIZE_05 => :CAUSES_CODE_88": 6,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_88": 11,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_99": 5,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_99": 9,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_118": 8,
          ":EFFECTS_CODE_15 => :CAUSES_CODE_68": 10,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_69": 6,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_68": 16,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_29": 27,
          ":EFFECTS_CODE_37 => :CAUSES_CODE_88": 8,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_14": 6,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_65": 8,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_25": 6,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_112": 12,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_88": 49,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_38": 7,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_46": 8,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_65": 10,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_42": 18,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_42": 10,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_48": 22,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_65": 14,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_46": 27,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_37": 18,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_65": 20,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_88": 24,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_47": 9,
          ":CONTEXT_SIZE_04 => :CAUSES_CODE_89": 5,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_48": 34,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_108": 22,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_65": 18,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_65": 14,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_48": 9,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_42": 30,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_88": 32,
          ":PROBLEMS_CODE_18 => :CAUSES_CODE_56": 9,
          ":EFFECTS_CODE_02 => :CAUSES_CODE_42": 8,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_108": 14,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_47": 5,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_46": 20,
          ":EFFECTS_CODE_04 => :CAUSES_CODE_39": 9,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_69": 5,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_115": 8,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_89": 8,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_55": 11,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_37": 21,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_42": 17,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_88": 13,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_108": 6,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_02": 8,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_46": 18,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_93": 17,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_115": 8,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_39": 6,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_30": 6,
          ":EFFECTS_CODE_21 => :CAUSES_CODE_02": 9,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_02": 15,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_14": 8,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_112": 6,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_116": 20,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_118": 10,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_25": 12,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_44": 6,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_89": 11,
          ":PROBLEMS_CODE_11 => :CAUSES_CODE_14": 10,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_85": 5,
          ":PROBLEMS_CODE_07 => :CAUSES_CODE_65": 11,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_42": 13,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_44": 6,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_68": 32,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_42": 19,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_37": 9,
          ":EFFECTS_CODE_36 => :CAUSES_CODE_65": 5,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_14": 5,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_02": 68,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_93": 5,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_65": 20,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_38": 9,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_68": 19,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_48": 70,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_29": 8,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_85": 14,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_118": 9,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_44": 18,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_112": 7,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_100": 8,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_118": 10,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_02": 8,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_85": 12,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_89": 13,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_56": 13,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_65": 5,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_14": 17,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_56": 9,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_25": 14,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_25": 36,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_93": 5,
          ":EFFECTS_CODE_16 => :CAUSES_CODE_37": 5,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_85": 17,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_99": 9,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_116": 8,
          ":EFFECTS_CODE_35 => :CAUSES_CODE_68": 11,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_116": 19,
          ":EFFECTS_CODE_21 => :CAUSES_CODE_42": 5,
          ":PROBLEMS_CODE_08 => :CAUSES_CODE_44": 13,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_02": 19,
          ":EFFECTS_CODE_43 => :CAUSES_CODE_88": 7,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_48": 25,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_02": 5,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_112": 19,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_88": 36,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_89": 7,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_37": 18,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_100": 12,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_93": 8,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_02": 15,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_29": 16,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_69": 25,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_93": 11,
          ":EFFECTS_CODE_35 => :CAUSES_CODE_42": 7,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_69": 6,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_44": 17,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_65": 9,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_48": 23,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_88": 41,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_38": 6,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_112": 10,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_02": 12,
          ":PROBLEMS_CODE_15 => :CAUSES_CODE_85": 6,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_99": 10,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_118": 5,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_100": 9,
          ":PROBLEMS_CODE_13 => :CAUSES_CODE_42": 8,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_65": 27,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_100": 12,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_14": 10,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_118": 5,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_108": 17,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_88": 16,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_46": 9,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_99": 13,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_88": 83,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_69": 7,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_37": 40,
          ":EFFECTS_CODE_21 => :CAUSES_CODE_89": 12,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_48": 55,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_89": 42,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_115": 7,
          ":EFFECTS_CODE_37 => :CAUSES_CODE_68": 5,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_25": 26,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_48": 35,
          ":PROBLEMS_CODE_08 => :CAUSES_CODE_06": 8,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_68": 15,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_89": 14,
          ":EFFECTS_CODE_21 => :CAUSES_CODE_112": 12,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_48": 24,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_112": 11,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_112": 15,
          ":PROBLEMS_CODE_18 => :CAUSES_CODE_02": 6,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_14": 14,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_46": 11,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_42": 29,
          ":PROBLEMS_CODE_04 => :CAUSES_CODE_37": 5,
          ":EFFECTS_CODE_02 => :CAUSES_CODE_37": 8,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_100": 14,
          ":EFFECTS_CODE_43 => :CAUSES_CODE_29": 8,
          ":EFFECTS_CODE_39 => :CAUSES_CODE_88": 8,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_68": 6,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_02": 13,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_44": 7,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_08": 11,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_65": 5,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_85": 10,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_14": 12,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_93": 12,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_89": 15,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_65": 7,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_48": 5,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_25": 38,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_88": 21,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_37": 42,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_100": 9,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_39": 9,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_25": 10,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_46": 5,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_39": 8,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_37": 10,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_108": 16,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_100": 14,
          ":EFFECTS_CODE_38 => :CAUSES_CODE_48": 7,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_55": 18,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_06": 9,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_116": 14,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_69": 8,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_118": 8,
          ":PROBLEMS_CODE_18 => :CAUSES_CODE_55": 9,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_38": 9,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_118": 13,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_108": 5,
          ":EFFECTS_CODE_07 => :CAUSES_CODE_02": 8,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_06": 16,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_44": 7,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_55": 6,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_88": 57,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_39": 26,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_02": 12,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_68": 25,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_44": 10,
          ":PROBLEMS_CODE_12 => :CAUSES_CODE_48": 5,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_39": 12,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_55": 6,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_42": 18,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_89": 11,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_38": 13,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_25": 8,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_42": 12,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_47": 11,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_55": 26,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_108": 22,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_25": 8,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_112": 28,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_88": 11,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_06": 19,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_08": 8,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_29": 15,
          ":EFFECTS_CODE_52 => :CAUSES_CODE_68": 6,
          ":EFFECTS_CODE_15 => :CAUSES_CODE_14": 6,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_85": 15,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_48": 17,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_02": 9,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_89": 10,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_88": 13,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_99": 14,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_69": 18,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_37": 10,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_65": 24,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_68": 43,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_69": 13,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_68": 23,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_46": 13,
          ":EFFECTS_CODE_23 => :CAUSES_CODE_89": 6,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_37": 9,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_37": 8,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_46": 16,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_118": 11,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_65": 12,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_02": 32,
          ":EFFECTS_CODE_43 => :CAUSES_CODE_112": 11,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_14": 9,
          ":EFFECTS_CODE_44 => :CAUSES_CODE_65": 5,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_108": 7,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_93": 10,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_46": 7,
          ":PROBLEMS_CODE_18 => :CAUSES_CODE_65": 14,
          ":EFFECTS_CODE_13 => :CAUSES_CODE_38": 7,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_48": 9,
          ":PROBLEMS_CODE_07 => :CAUSES_CODE_14": 6,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_68": 75,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_42": 12,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_44": 6,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_118": 7,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_48": 10,
          ":PROBLEMS_CODE_03 => :CAUSES_CODE_48": 6,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_14": 7,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_68": 8,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_47": 12,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_112": 7,
          ":EFFECTS_CODE_44 => :CAUSES_CODE_30": 6,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_85": 6,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_89": 8,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_46": 25,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_93": 6,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_08": 8,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_88": 48,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_48": 19,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_46": 5,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_56": 16,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_06": 15,
          ":PROBLEMS_CODE_19 => :CAUSES_CODE_39": 17,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_30": 8,
          ":PROBLEMS_CODE_13 => :CAUSES_CODE_68": 38,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_108": 7,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_44": 6,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_14": 18,
          ":CONTEXT_SIZE_05 => :CAUSES_CODE_65": 6,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_115": 5,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_37": 27,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_55": 17,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_25": 8,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_99": 26,
          ":EFFECTS_CODE_21 => :CAUSES_CODE_37": 12,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_65": 17,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_88": 42,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_85": 6,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_46": 7,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_68": 32,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_115": 10,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_99": 8,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_99": 5,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_39": 7,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_37": 29,
          ":PROBLEMS_CODE_02 => :CAUSES_CODE_02": 13,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_115": 25,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_68": 11,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_85": 22,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_37": 24,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_39": 8,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_46": 13,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_48": 23,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_42": 47,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_39": 21,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_116": 6,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_38": 8,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_46": 16,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_112": 7,
          ":PROBLEMS_CODE_15 => :CAUSES_CODE_42": 16,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_108": 6,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_89": 37,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_46": 29,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_89": 9,
          ":PROBLEMS_CODE_15 => :CAUSES_CODE_65": 8,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_47": 8,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_47": 6,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_02": 5,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_39": 15,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_89": 10,
          ":PROBLEMS_CODE_09 => :CAUSES_CODE_46": 11,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_65": 31,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_85": 29,
          ":EFFECTS_CODE_02 => :CAUSES_CODE_48": 8,
          ":CONTEXT_SIZE_04 => :CAUSES_CODE_46": 6,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_93": 8,
          ":CONTEXT_DEV_CODE_00 => :CAUSES_CODE_02": 18,
          ":CONTEXT_SIZE_04 => :CAUSES_CODE_44": 5,
          ":PROBLEMS_CODE_15 => :CAUSES_CODE_48": 7,
          ":EFFECTS_CODE_44 => :CAUSES_CODE_99": 6,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_55": 8,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_48": 9,
          ":PROBLEMS_CODE_18 => :CAUSES_CODE_39": 6,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_14": 33,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_100": 5,
          ":PROBLEMS_CODE_03 => :CAUSES_CODE_14": 7,
          ":PROBLEMS_CODE_20 => :CAUSES_CODE_112": 8,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_37": 9,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_25": 6,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_06": 11,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_65": 13,
          ":PROBLEMS_CODE_10 => :CAUSES_CODE_14": 6,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_42": 24,
          ":EFFECTS_CODE_35 => :CAUSES_CODE_99": 9,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_99": 13,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_38": 12,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_48": 41,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_69": 8,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_55": 7,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_48": 109,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_55": 13,
          ":PROBLEMS_CODE_13 => :CAUSES_CODE_112": 29,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_118": 7,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_89": 26,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_14": 5,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_06": 6,
          ":EFFECTS_CODE_26 => :CAUSES_CODE_14": 5,
          ":PROBLEMS_CODE_16 => :CAUSES_CODE_88": 12,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_39": 5,
          ":PROBLEMS_CODE_07 => :CAUSES_CODE_02": 6,
          ":EFFECTS_CODE_22 => :CAUSES_CODE_88": 8,
          ":CONTEXT_SIZE_02 => :CAUSES_CODE_88": 56,
          ":EFFECTS_CODE_23 => :CAUSES_CODE_38": 9,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_88": 45,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_108": 6,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_30": 8,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_116": 9,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_112": 29,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_46": 8,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_108": 17,
          ":EFFECTS_CODE_42 => :CAUSES_CODE_25": 8,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_02": 48,
          ":EFFECTS_CODE_14 => :CAUSES_CODE_89": 6,
          ":CONTEXT_SIZE_00 => :CAUSES_CODE_02": 55,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_112": 11,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_46": 15,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_46": 37,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_44": 13,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_14": 38,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_56": 9,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_25": 8,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_68": 20,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_02": 32,
          ":PROBLEMS_CODE_19 => :CAUSES_CODE_48": 10,
          ":EFFECTS_CODE_05 => :CAUSES_CODE_89": 6,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_65": 35,
          ":PROBLEMS_CODE_11 => :CAUSES_CODE_68": 12,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_37": 47,
          ":EFFECTS_CODE_21 => :CAUSES_CODE_65": 10,
          ":PROBLEMS_CODE_04 => :CAUSES_CODE_89": 6,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_02": 37,
          ":EFFECTS_CODE_43 => :CAUSES_CODE_25": 8,
          ":EFFECTS_CODE_04 => :CAUSES_CODE_88": 8,
          ":PROBLEMS_CODE_05 => :CAUSES_CODE_42": 20,
          ":EFFECTS_CODE_40 => :CAUSES_CODE_02": 11,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_100": 6,
          ":PROBLEMS_CODE_01 => :CAUSES_CODE_14": 10,
          ":CONTEXT_DEV_CODE_03 => :CAUSES_CODE_42": 14,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_30": 16,
          ":CONTEXT_SYSTEM_00 => :CAUSES_CODE_69": 6,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_48": 50,
          ":PROBLEMS_CODE_19 => :CAUSES_CODE_42": 8,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_39": 37,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_48": 24,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_38": 11,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_56": 12,
          ":EFFECTS_CODE_35 => :CAUSES_CODE_02": 6,
          ":CONTEXT_DEV_CODE_01 => :CAUSES_CODE_112": 6,
          ":CONTEXT_SYSTEM_01 => :CAUSES_CODE_85": 38,
          ":PROBLEMS_CODE_19 => :CAUSES_CODE_68": 21,
          ":CONTEXT_SIZE_01 => :CAUSES_CODE_08": 12,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_65": 29,
          ":PROBLEMS_CODE_14 => :CAUSES_CODE_02": 5,
          ":CONTEXT_DISTRIBUTED_00 => :CAUSES_CODE_46": 51,
          ":EFFECTS_CODE_49 => :CAUSES_CODE_48": 23,
          ":CONTEXT_SYSTEM_02 => :CAUSES_CODE_85": 9,
          ":CONTEXT_DEV_CODE_04 => :CAUSES_CODE_46": 8,
          ":EFFECTS_CODE_04 => :CAUSES_CODE_108": 6,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_116": 19,
          ":CONTEXT_SIZE_03 => :CAUSES_CODE_46": 15,
          ":PROBLEMS_CODE_06 => :CAUSES_CODE_68": 6,
          ":CONTEXT_DEV_CODE_02 => :CAUSES_CODE_39": 24,
          ":EFFECTS_CODE_01 => :CAUSES_CODE_14": 9,
          ":EFFECTS_CODE_01 => :CAUSES_CODE_88": 18,
          ":EFFECTS_CODE_35 => :CAUSES_CODE_39": 7,
          ":EFFECTS_CODE_37 => :CAUSES_CODE_85": 36
      },
      "items": {
          "CONTEXT_DISTRIBUTED": [
              "CONTEXT_DISTRIBUTED_00"
          ],
          "CONTEXT_SIZE": [
              "CONTEXT_SIZE_01",
              "CONTEXT_SIZE_04",
              "CONTEXT_SIZE_03",
              "CONTEXT_SIZE_00",
              "CONTEXT_SIZE_02",
              "CONTEXT_SIZE_05"
          ],
          "RELATIONSHIP": [],
          "PROBLEMS_CODE": [
              "PROBLEMS_CODE_19",
              "PROBLEMS_CODE_02",
              "PROBLEMS_CODE_15",
              "PROBLEMS_CODE_03",
              "PROBLEMS_CODE_14",
              "PROBLEMS_CODE_10",
              "PROBLEMS_CODE_16",
              "PROBLEMS_CODE_01",
              "PROBLEMS_CODE_09",
              "PROBLEMS_CODE_11",
              "PROBLEMS_CODE_13",
              "PROBLEMS_CODE_05",
              "PROBLEMS_CODE_07",
              "PROBLEMS_CODE_12",
              "PROBLEMS_CODE_20",
              "PROBLEMS_CODE_06",
              "PROBLEMS_CODE_18",
              "PROBLEMS_CODE_08",
              "PROBLEMS_CODE_04"
          ],
          "CONTEXT_DEV": [
              "CONTEXT_DEV_CODE_04",
              "CONTEXT_DEV_CODE_01",
              "CONTEXT_DEV_CODE_02",
              "CONTEXT_DEV_CODE_03",
              "CONTEXT_DEV_CODE_00"
          ],
          "CAUSES_CODE": [
              "CAUSES_CODE_56",
              "CAUSES_CODE_42",
              "CAUSES_CODE_112",
              "CAUSES_CODE_116",
              "CAUSES_CODE_38",
              "CAUSES_CODE_65",
              "CAUSES_CODE_02",
              "CAUSES_CODE_85",
              "CAUSES_CODE_08",
              "CAUSES_CODE_118",
              "CAUSES_CODE_37",
              "CAUSES_CODE_115",
              "CAUSES_CODE_29",
              "CAUSES_CODE_06",
              "CAUSES_CODE_55",
              "CAUSES_CODE_39",
              "CAUSES_CODE_30",
              "CAUSES_CODE_99",
              "CAUSES_CODE_89",
              "CAUSES_CODE_93",
              "CAUSES_CODE_25",
              "CAUSES_CODE_46",
              "CAUSES_CODE_14",
              "CAUSES_CODE_100",
              "CAUSES_CODE_88",
              "CAUSES_CODE_69",
              "CAUSES_CODE_47",
              "CAUSES_CODE_108",
              "CAUSES_CODE_48",
              "CAUSES_CODE_68",
              "CAUSES_CODE_44"
          ],
          "CONTEXT_SYSTEM": [
              "CONTEXT_SYSTEM_00",
              "CONTEXT_SYSTEM_01",
              "CONTEXT_SYSTEM_02"
          ],
          "EFFECTS_CODE": [
              "EFFECTS_CODE_49",
              "EFFECTS_CODE_44",
              "EFFECTS_CODE_36",
              "EFFECTS_CODE_42",
              "EFFECTS_CODE_04",
              "EFFECTS_CODE_14",
              "EFFECTS_CODE_15",
              "EFFECTS_CODE_23",
              "EFFECTS_CODE_16",
              "EFFECTS_CODE_38",
              "EFFECTS_CODE_02",
              "EFFECTS_CODE_01",
              "EFFECTS_CODE_40",
              "EFFECTS_CODE_05",
              "EFFECTS_CODE_22",
              "EFFECTS_CODE_28",
              "EFFECTS_CODE_35",
              "EFFECTS_CODE_37",
              "EFFECTS_CODE_43",
              "EFFECTS_CODE_26",
              "EFFECTS_CODE_18",
              "EFFECTS_CODE_21",
              "EFFECTS_CODE_52",
              "EFFECTS_CODE_39",
              "EFFECTS_CODE_07",
              "EFFECTS_CODE_13"
          ]
      }
  },

  "/infer": 6,
  "/tasks": {
      "result": {
        "data":{"CAUSES_CODE_06":0.068,"CAUSES_CODE_65":0.08600000000000001,"CAUSES_CODE_89":0.116,"CAUSES_CODE_118":0.076,"CAUSES_CODE_08":0.11,"CAUSES_CODE_48":0.15400000000000003,"CAUSES_CODE_99":0.066},
        "plot":"data:image/png;base64,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0qTg4GA8XOWHH37QaDQIIalUescdd/T19XV2dra2tjY3N1dUVODNDvl8fk5Ozm233VZQUJCfnw9JAnA5Y15zAwMDfX19KysrKyoqOByOwWC48847eTweXHPty8rz0sWLF5ubmxFCoaGhU6ZMsTwvXb9+vb6+nqZpiUSSk5Mze/ZsOC/ZwJr2ktFo/P7773k8ntlsTklJiY+PJ+2l1tbWqqoqvKFgUFDQjBkzZs2axZL2EuTJTDKZTCdOnNi9e/fu3bsbGxvlcvnMmTMLCgrwqteBgYGffPJJRUVFaGjo448/bvmLNE3/13/9l06nmzt37ty5c8m71dbWlpWVnT179vjx4yUlJWazOS8vb9myZcuXL4+OjmbiT5yQMesHv6y0tHTXrl0IoRdffBEvUnWzd/PM+sGefvrpiooKhBBFUTt37lQoFDe+m5vVj21qamq++eab3bt3nz17lsvlZmdnFxQU5ObmpqamxsTE3Lj15ffff3/y5EkfH5/nn3/e8oReWVn51ltvDQ4O9vf3JyUllZeXnzx5UqVShYeHL1u2bNmyZTNnzoS714Dl+vr6vv/++927d+/bt29wcDAmJqagoGDGjBlTpkxJTEy8sUP4p+TPCmIAACAASURBVJ9++vrrrxFCy5cvv/322y1/tG3btoqKit7e3ri4uKqqquPHj9fV1Uml0gULFtx1110LFy4kS6ECwE7juuYihLq7u1988UWapqOiop5//vkb3w2uubYZ73mpoaHh3XffRQitX7/+xtX1NRrN5cuXL126dPLkSTgvjct420uvvfbatWvXKIp69dVX8aR9S21tbeXl5efPnz9+/DiL2ks0YEJLS8srr7yCD9fk5OT//M//LC4uNplMw17W39//l7/85aOPPrrxHbZu3fryyy8PDg7e7CMGBgb27Nnz0EMPKRQKiqJmz569c+dOnU5n3z/EQaysH8xsNr/11luvvPLKuD7Cc+oHO3DgAL6rsn79ems+wqXrxwZarfbzzz8vKChACCkUilWrVu3Zs2dgYGDMX2xsbNywYcMPP/ww7PkLFy6sWbNm7dq1586dw88Yjcbi4uL/+I//SE5ORghFRES8+uqrra2t9v9jAJiws2fPPvTQQ2KxmM/n33777Vu2bGlsbBzzt3p7e9euXbt27dqenp5hP9q6deuGDRtKSkrIM42NjVu2bLn99tv5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"}
    }
  }

}
