import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-ranking',
  templateUrl: './ranking.component.html',
  styleUrls: ['./ranking.component.scss']
})
export class RankingComponent implements OnInit {

  constructor() { }

  ngOnInit() {
    console.log(this.descriptions);
  }

  descriptions = {
      "CONTEXT_SIZE_00": "asdfgh",
      "CONTEXT_SIZE_01": "dcvvbvcb",
      "CONTEXT_SIZE_02": "eeeee",
      "CONTEXT_SIZE_03": "zzzz",
      "CONTEXT_SIZE_04": "yyyy"
    };

  sliderDisplayWith = (size) => {
    return this.descriptions["CONTEXT_SIZE_0" + size];
  };

}
