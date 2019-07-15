import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, ActivationEnd, Router } from '@angular/router';

import { ImageComponent } from '../image/image.component';
import { MatDialog } from '@angular/material/dialog';

import { Observable, of, timer, throwError, zip } from 'rxjs';
import { catchError, map, flatMap, filter, retry, tap } from 'rxjs/operators';

import { fallback_data } from './fallback-data';
import { models } from './models';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss']
})
export class RankingComponent {

  private MAX_ITEMS = 5;

  private errorHandler = err => {
    let p = new URL(err.url).pathname
    if(fallback_data[p]) {
      return timer(1000).pipe(map(t => fallback_data[p]));
    } else {
      alert("Request to " + p + " failed: " + err.statusText + " (" + err.status + ")");
      return throwError(err);
    }
  };

  constructor(private http: HttpClient, private dialog: MatDialog, private activatedRoute: ActivatedRoute, private router: Router, private sanitizer: DomSanitizer) {
    this.activatedRoute.queryParams.pipe(
        flatMap(params => {
          let model_id = params['model'] ? params['model'] : 'Cause analyzer';

          this.model = models[model_id]['model'];
          this.generic_categories = models[model_id]['generic_categories'];

          let obs = (model_id == this.model_id) ? of({ 'params': params, 'descriptions': this.descriptions, 'task_data': undefined, 'items': this.items }) : http.post("/descriptions", this.model).pipe(
            catchError(this.errorHandler),
            flatMap(descriptions => http.post("/items", this.model).pipe(
                catchError(this.errorHandler),
                map(items => {
                  for(let c in this.generic_categories) {
                    descriptions[c] = this.generic_categories[c];
                  }

                  // remove NotCodable, sort generic categories by description
                  for(let c in this.generic_categories) {
                    items.items[c] = items.items[c].filter(it => descriptions[it] != "NotCodable");

                    items.items[c].sort( (f1, f2) => descriptions[f1].localeCompare(descriptions[f2]) );
                  }

                  // sort others by  their item id
                  for(let c in items.items) {
                    if(this.generic_categories[c]) {
                      continue;
                    }
                    items.items[c].sort( (f1, f2) => f1.localeCompare(f2) );
                  }

                  return { "params": params, "descriptions": descriptions, 'task_data': undefined, 'items' : items };
                })
              )));
          this.model_id = model_id;
          return obs;
        }),
        map(result => {
          this.descriptions = result.descriptions;
          this.items = result.items;
          this.loaded = true;
          return result;
        }),
        flatMap(result => {
          let taskId = result.params['id'];
          let obs:Observable<any>;
          if(!taskId) {
            obs = of({ 'state': 'NOTASK' });
          } else if (taskId == this.task_id) {
            obs = of(this.task_data);
          } else {
            obs = this.http.get('/tasks?printresult=true&id=' + taskId);
          }
          this.task_id = taskId;

          return obs.pipe(
            catchError(this.errorHandler),
            flatMap(task_data => (task_data.state == 'RUNNING') ? timer(1000).pipe(flatMap(t => throwError('RUNNING'))) : of(task_data)),
            retry(),
            map(task_data => {
              this.task_data = task_data;
              result.task_data = task_data;
              return result;
            }));
        }),
        //catchError(err => of({ 'state': 'FAILED', 'result': err }))
      ).subscribe(result => {
        let task_data = result.task_data;
        this.running = false;

        if(task_data.state == 'FAILED') {
          this.task_result = null;
          this.task_shortresult = null;
          this.plot = null;
        } else if(task_data.state == 'NOTASK') {
          this.router.navigate( [ ], { relativeTo: this.activatedRoute, queryParams: { 'model' : result.params['model'] } });
          return;
        }

        this.plot = this.sanitizer.bypassSecurityTrustUrl(task_data.result.plot);

        let task_result:any = Object.entries(task_data.result.data);
        task_result.sort( (r1, r2) => r2[1] - r1[1] );
        this.task_result = [];
        this.task_shortresult = [];
        for(let i = 0; i < task_result.length; i++) {
          let val = [ i + 1, this.descriptions[task_result[i][0]], Math.round(task_result[i][1] * 100) ];
          this.task_result.push(val);
          if(i < this.MAX_ITEMS) {
            this.task_shortresult.push(val);
          }
        }
      });
  }

  model_id:any = null;
  task_id:any = null;

  model:any = null;
  generic_categories:any = null;

  descriptions:any = null;
  task_data:any = null;
  items:any = null;

  loaded:boolean = false;
  running:boolean = false;

  showall:boolean = false;
  task_result:any = null;
  task_shortresult:any = null;

  plot:any = null;
  plot_svg:boolean = false;

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
    this.dialog.open(ImageComponent, { "data": this.plot, maxHeight: '80%', minWidth: '500px', maxWidth: '80%' });
  }
}
