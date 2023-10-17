import { Component, Input, OnInit } from "@angular/core";

@Component({
  selector: 'app-external-explorer-link',
  templateUrl: './external-explorer-link.component.html',
  styleUrls: ['./external-explorer-link.component.scss']
})
export class ExternalExplorerLinkComponent implements OnInit {
  @Input() path!: string;

  constructor() { }

  ngOnInit(): void {
  }

}
