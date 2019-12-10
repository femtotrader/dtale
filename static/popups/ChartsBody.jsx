import chroma from "chroma-js";
import $ from "jquery";
import _ from "lodash";
import moment from "moment";
import PropTypes from "prop-types";
import React from "react";

import { Bouncer } from "../Bouncer";
import { RemovableError } from "../RemovableError";
import chartUtils from "../chartUtils";
import { isDateCol } from "../dtale/gridUtils";
import { fetchJson } from "../fetcher";

function toggleBouncer() {
  $("#chart-bouncer").toggle();
  $("#coveragePopup").toggle();
}

const COLOR_PROPS = [
  "borderColor",
  "backgroundColor",
  "pointHoverBackgroundColor",
  "pointBorderColor",
  "pointBackgroundColor",
  "pointHoverBackgroundColor",
  "pointHoverBorderColor",
];

function createChart(ctx, fetchedData, { columns, x, y, additionalOptions, chartType }) {
  const { data } = fetchedData;
  const colors = chroma.scale(["orange", "yellow", "green", "lightblue", "darkblue"]).domain([0, _.size(data)]);
  const cfg = {
    type: chartType || "line",
    data: {
      labels: _.get(_.values(data), "0.x"),
      datasets: _.map(_.toPairs(data), ([k, v], i) => {
        const color = colors(i).hex();
        const ptCfg = {
          fill: false,
          lineTension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 5,
          data: v.y,
        };
        if (k !== "all") {
          ptCfg.label = k;
        }
        _.forEach(COLOR_PROPS, cp => (ptCfg[cp] = color));
        return ptCfg;
      }),
    },
    options: _.assignIn(
      {
        responsive: true,
        pan: { enabled: true, mode: "x" },
        zoom: { enabled: true, mode: "x", speed: 0.5 },
        tooltips: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: (tooltipItem, data) => {
              const value = _.round(tooltipItem.yLabel, 4);
              if(_.size(data) > 1) {
                const label = data.datasets[tooltipItem.datasetIndex].label || '';
                if (label) {
                  return `${label}: ${value}`;
                }
              }
              return value;
            },
          },
        },
        hover: {
          mode: "nearest",
          intersect: true,
        },
        scales: {
          xAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: x,
              },
            },
          ],
          yAxes: [
            {
              scaleLabel: {
                display: true,
                labelString: y,
              },
            },
          ],
        },
      },
      additionalOptions
    ),
  };
  if (isDateCol(_.find(columns, { name: x }).dtype)) {
    const units = _.size(cfg.data.labels) > 150 ? "month" : "day";
    cfg.options.scales.xAxes = [
      {
        type: "time",
        time: {
          unit: units,
          displayFormats: {
            [units]: "YYYYMMDD",
          },
        },
        ticks: {
          min: _.get(cfg.data.labels, "0"),
          max: _.get(cfg.data.labels, cfg.data.labels.length - 1),
        },
      },
    ];
    cfg.options.tooltips.callbacks.title = (tooltipItems, _data) =>
      moment(new Date(tooltipItems[0].xLabel)).format("YYYY-MM-DD");
  }
  if (_.size(cfg.data.datasets) < 2) {
    cfg.options.legend = { display: false };
  }
  return chartUtils.createChart(ctx, cfg);
}

class ChartsBody extends React.Component {
  constructor(props) {
    super(props);
    this.mounted = false;
    this.state = { chart: null, error: null };
    this.buildChart = this.buildChart.bind(this);
  }

  shouldComponentUpdate(newProps, newState) {
    if (!_.isEqual(this.props, newProps)) {
      return true;
    }

    if (this.state.error != newState.error) {
      return true;
    }

    if (this.state.chart != newState.chart) {
      // Don't re-render if we've only changed the chart.
      return false;
    }

    return false; // Otherwise, use the default react behaviour.
  }

  componentDidUpdate(prevProps) {
    if (!this.props.visible) {
      return;
    }
    if (prevProps.url !== this.props.url) {
      this.buildChart();
      return;
    }
    if (!_.isEqual(_.pick(this.props, ["chartType"]), _.pick(prevProps, ["chartType"]))) {
      const builder = ctx => {
        if (_.isEmpty(_.get(this.state.data, "data", {}))) {
          return null;
        }

        return createChart(ctx, this.state.data, this.props);
      };
      const chart = chartUtils.chartWrapper("chartCanvas", this.state.chart, builder);
      this.setState({ chart, error: null });
    }
  }

  componentDidMount() {
    this.mounted = true;
    this.buildChart();
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  buildChart() {
    if (_.isNil(this.props.url)) {
      return;
    }
    toggleBouncer();
    fetchJson(this.props.url, fetchedChartData => {
      toggleBouncer();
      if (this.mounted) {
        if (fetchedChartData.error) {
          this.setState({
            error: <RemovableError {...fetchedChartData} />,
            chart: null,
            data: null,
          });
          return;
        }
        if (_.isEmpty(_.get(fetchedChartData, "data", {}))) {
          this.setState({
            error: <RemovableError error="No data found." />,
            chart: null,
          });
          return;
        }
        const builder = ctx => {
          if (_.isEmpty(_.get(fetchedChartData, "data", {}))) {
            return null;
          }

          return createChart(ctx, fetchedChartData, this.props);
        };
        const chart = chartUtils.chartWrapper("chartCanvas", this.state.chart, builder);
        this.setState({ chart, error: null, data: fetchedChartData });
      }
    });
  }

  render() {
    return (
      <div>
        <div id="chart-bouncer" style={{ display: "none" }}>
          <Bouncer />
        </div>
        {this.state.error}
        <canvas id="chartCanvas" height={this.props.height} />
      </div>
    );
  }
}

ChartsBody.displayName = "ChartsBody";
ChartsBody.propTypes = {
  url: PropTypes.string,
  columns: PropTypes.arrayOf(PropTypes.object),
  x: PropTypes.string, // eslint-disable-line react/no-unused-prop-types
  y: PropTypes.string, // eslint-disable-line react/no-unused-prop-types
  group: PropTypes.string, // eslint-disable-line react/no-unused-prop-types
  chartType: PropTypes.string,
  visible: PropTypes.bool.isRequired,
  height: PropTypes.number,
  additionalOptions: PropTypes.object, // eslint-disable-line react/no-unused-prop-types
};
ChartsBody.defaultProps = { height: 400 };

export default ChartsBody;
