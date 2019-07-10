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
  plot_svg:boolean = false;
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
        // svg plot
        "plot": "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIKICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8IS0tIEdlbmVyYXRlZCBieSBncmFwaHZpeiB2ZXJzaW9uIDIuNDAuMSAoMCkKIC0tPgo8IS0tIFBhZ2VzOiAxIC0tPgo8c3ZnIHdpZHRoPSI2MnB0IiBoZWlnaHQ9IjI5NnB0Igogdmlld0JveD0iMC4wMCAwLjAwIDYyLjAwIDI5Ni4wMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayI+CjxnIGlkPSJncmFwaDAiIGNsYXNzPSJncmFwaCIgdHJhbnNmb3JtPSJzY2FsZSgxIDEpIHJvdGF0ZSgwKSB0cmFuc2xhdGUoNCAyOTIpIj4KPHBvbHlnb24gZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSJ0cmFuc3BhcmVudCIgcG9pbnRzPSItNCw0IC00LC0yOTIgNTgsLTI5MiA1OCw0IC00LDQiLz4KPCEtLSBFRkZFQ1RTX0NPREVfNDEgLS0+CjxnIGlkPSJub2RlMSIgY2xhc3M9Im5vZGUiPgo8dGl0bGU+RUZGRUNUU19DT0RFXzQxPC90aXRsZT4KPGcgaWQ9ImFfbm9kZTEiPjxhIHhsaW5rOnRpdGxlPSJUaW1lIG92ZXJydW4iPgo8ZWxsaXBzZSBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAwMDAiIGN4PSIyNyIgY3k9Ii0xOCIgcng9IjI3IiByeT0iMTgiLz4KPHRleHQgdGV4dC1hbmNob3I9Im1pZGRsZSIgeD0iMjciIHk9Ii0xNC4zIiBmb250LWZhbWlseT0iVGltZXMsc2VyaWYiIGZvbnQtc2l6ZT0iMTQuMDAiIGZpbGw9IiMwMDAwMDAiPkVfNDE8L3RleHQ+CjwvYT4KPC9nPgo8L2c+CjwhLS0gUFJPQkxFTVNfQ09ERV8xMCAtLT4KPGcgaWQ9Im5vZGUyIiBjbGFzcz0ibm9kZSI+Cjx0aXRsZT5QUk9CTEVNU19DT0RFXzEwPC90aXRsZT4KPGcgaWQ9ImFfbm9kZTIiPjxhIHhsaW5rOnRpdGxlPSJNb3ZpbmcgdGFyZ2V0cyAoY2hhbmdpbmcgZ29hbHMsIGJ1c2luZXNzIHByb2Nlc3NlcyBhbmQgLyBvciByZXF1aXJlbWVudHMpIj4KPGVsbGlwc2UgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDAwMDAwIiBjeD0iMjciIGN5PSItMjcwIiByeD0iMjciIHJ5PSIxOCIvPgo8dGV4dCB0ZXh0LWFuY2hvcj0ibWlkZGxlIiB4PSIyNyIgeT0iLTI2Ni4zIiBmb250LWZhbWlseT0iVGltZXMsc2VyaWYiIGZvbnQtc2l6ZT0iMTQuMDAiIGZpbGw9IiMwMDAwMDAiPlBfMTA8L3RleHQ+CjwvYT4KPC9nPgo8L2c+CjwhLS0gUFJPQkxFTVNfQ09ERV8xMCYjNDU7Jmd0O0VGRkVDVFNfQ09ERV80MSAtLT4KPGcgaWQ9ImVkZ2UxIiBjbGFzcz0iZWRnZSI+Cjx0aXRsZT5QUk9CTEVNU19DT0RFXzEwJiM0NTsmZ3Q7RUZGRUNUU19DT0RFXzQxPC90aXRsZT4KPGcgaWQ9ImFfZWRnZTEiPjxhIHhsaW5rOnRpdGxlPSJNb3ZpbmcgdGFyZ2V0cyAoY2hhbmdpbmcgZ29hbHMsIGJ1c2luZXNzIHByb2Nlc3NlcyBhbmQgLyBvciByZXF1aXJlbWVudHMpJiMxMDsgJiM0NTsmIzQ1OyYjNDU7Jmd0OyAmIzEwO1RpbWUgb3ZlcnJ1biI+CjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgc3Ryb2tlLXdpZHRoPSI1IiBkPSJNMjcsLTI1MS44NzY4QzI3LC0yMDguNTczOSAyNywtOTguODIwNyAyNywtNDYuNTM3NCIvPgo8cG9seWdvbiBmaWxsPSIjMDAwMDAwIiBzdHJva2U9IiMwMDAwMDAiIHN0cm9rZS13aWR0aD0iNSIgcG9pbnRzPSIzMS4zNzUxLC00Ni4yOTc2IDI3LC0zNi4yOTc2IDIyLjYyNTEsLTQ2LjI5NzYgMzEuMzc1MSwtNDYuMjk3NiIvPgo8L2E+CjwvZz4KPC9nPgo8L2c+Cjwvc3ZnPgo=",

        // png plot
//         "plot": "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"
      }
    }
  }
}
