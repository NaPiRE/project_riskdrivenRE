import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'app-image',
  templateUrl: './image.component.html',
  styleUrls: ['./image.component.scss']
})
export class ImageComponent {

  constructor(@Inject(MAT_DIALOG_DATA) public image: any, public dialogRef: MatDialogRef<ImageComponent>) { }

  public zoomed: boolean = false;

}
