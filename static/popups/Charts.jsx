import _ from "lodash";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import Select, { createFilter } from "react-select";

import ConditionalRender from "../ConditionalRender";
import { JSAnchor } from "../JSAnchor";
import { RemovableError } from "../RemovableError";
import { buildURLString } from "../actions/url-utils";
import { fetchJson } from "../fetcher";
import ChartsBody from "./ChartsBody";

function generateChartState({ group, x, y, query }) {
  if (_.isNull(x) || _.isNull(y)) {
    return { url: null, desc: null };
  }
  const params = { x: x.value, y: y.value, query };
  if (!_.isNull(group)) {
    params.group = group.value;
  }
  return { url: buildURLString("/dtale/chart-data", params) };
}

const baseState = query => ({
  x: null,
  y: null,
  group: null,
  chartType: { value: "line" },
  url: null,
  zoomed: null,
  query,
});

require("./CoverageChart.css");

class ReactCharts extends React.Component {
  constructor(props) {
    super(props);
    this.state = baseState(_.get(props, "chartData.query"));
    this.viewTimeDetails = this.viewTimeDetails.bind(this);
    this.resetZoom = this.resetZoom.bind(this);
    this.renderLabel = this.renderLabel.bind(this);
    this.renderSelect = this.renderSelect.bind(this);
  }

  componentDidMount() {
    fetchJson("/dtale/dtypes", data => {
      if (data.error) {
        this.setState({ error: <RemovableError {...data} /> });
        return;
      }
      const { dtypes } = data;
      this.setState({ columns: dtypes });
    });
  }

  renderSelect(prop, otherProps) {
    const { columns } = this.state;
    let finalOptions = _.map(columns, c => ({ value: c.name }));
    finalOptions = _.reject(finalOptions, _.compact(_.map(otherProps, p => _.get(this.state, [p, "value"]))));
    return (
      <div className="input-group mr-3">
        <Select
          className="Select is-clearable is-searchable Select--single"
          classNamePrefix="Select"
          options={_.sortBy(finalOptions, o => _.toLower(o.value))}
          getOptionLabel={_.property("value")}
          getOptionValue={_.property("value")}
          value={this.state[prop]}
          onChange={selected => this.setState({ [prop]: selected })}
          noOptionsText={() => "No columns found"}
          isClearable
          filterOption={createFilter({ ignoreAccents: false })} // required for performance reasons!
        />
      </div>
    );
  }

  resetZoom() {
    const chart = _.get(this, "_chart.state.chart");
    if (chart) {
      delete chart.options.scales.xAxes[0].ticks;
      chart.update();
      this.setState({ zoomed: false });
    }
  }

  viewTimeDetails(evt) {
    const chart = _.get(this, "_chart.state.chart");
    if (chart) {
      const selectedPoint = _.head(chart.getElementAtEvent(evt));
      if (selectedPoint) {
        const ticks = {
          min: chart.data.labels[_.max([0, selectedPoint._index - 10])],
          max: chart.data.labels[_.min([chart.data.labels.length - 1, selectedPoint._index + 10])],
        };
        chart.options.scales.xAxes[0].ticks = ticks;
        chart.update();
        this.setState({ zoomed: `${ticks.min} - ${ticks.max}` });
      }
    }
  }

  renderLabel() {
    const { zoomed } = this.state;
    return (
      <ConditionalRender display={!_.isEmpty(zoomed)}>
        <div className="coverage-desc">
          <span className="pr-3" style={{ marginLeft: "3em" }}>{`Zoomed: ${zoomed}`}</span>
          <JSAnchor onClick={this.resetZoom}>{"X"}</JSAnchor>
        </div>
      </ConditionalRender>
    );
  }

  render() {
    const { columns } = this.state;
    if (_.isEmpty(columns)) {
      return null;
    }
    return (
      <div className="charts-body">
        <div className="row pl-5 pt-3 pb-3 correlations-filters">
          <span className="mb-auto mt-auto">Chart:</span>
          <div className="col-auto">
            <div className="input-group mr-3">
              <Select
                className="Select is-clearable is-searchable Select--single"
                classNamePrefix="Select"
                options={[{ value: "line" }, { value: "bar" }]}
                getOptionLabel={_.property("value")}
                getOptionValue={_.property("value")}
                value={this.state.chartType}
                onChange={selected => this.setState({ chartType: selected })}
                filterOption={createFilter({ ignoreAccents: false })} // required for performance reasons!
              />
            </div>
          </div>
          <span className="pl-3 mb-auto mt-auto">X:</span>
          <div className="col-auto">{this.renderSelect("x", ["y", "group"])}</div>
          <span className="mb-auto mt-auto">Y:</span>
          <div className="col-auto">{this.renderSelect("y", ["x", "group"])}</div>
          <span className="mb-auto mt-auto">Group:</span>
          <div className="col-auto">{this.renderSelect("group", ["x", "y"])}</div>
          <div className="col">
            <button
              className="btn btn-primary float-right"
              onClick={() => this.setState(generateChartState(this.state))}>
              <span>Load</span>
            </button>
          </div>
        </div>
        <div className="row pl-5 pt-3 pb-3 correlations-filters">
          <span className="mb-auto mt-auto">Query</span>
          <div className="col">
            <input
              className="form-control input-sm"
              type="text"
              value={this.state.query || ""}
              onChange={e => this.setState({ query: e.target.value })}
            />
          </div>
        </div>
        <div className="row pb-3">
          <div className="col-md-10">{this.renderLabel()}</div>
        </div>
        <ChartsBody
          ref={r => (this._chart = r)}
          visible={_.get(this.props, "chartData.visible", false)}
          url={this.state.url}
          columns={this.state.columns}
          chartType={_.get(this.state, "chartType.value")}
          x={_.get(this.state, "x.value")}
          y={_.get(this.state, "y.value")}
          group={_.get(this.state, "group.value")}
          additionalOptions={{
            onClick: this.viewTimeDetails,
          }}
          height={450}
        />
      </div>
    );
  }
}
ReactCharts.displayName = "Charts";
ReactCharts.propTypes = {
  chartData: PropTypes.shape({
    visible: PropTypes.bool.isRequired,
    query: PropTypes.string,
  }),
};

const ReduxCharts = connect(({ chartData }) => ({ chartData }))(ReactCharts);

export { ReactCharts, ReduxCharts as Charts };
