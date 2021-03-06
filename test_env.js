import { configure } from "enzyme";
import Adapter from "enzyme-adapter-react-16";

configure({ adapter: new Adapter() });

// required for react-data-grid & react-bootstrap-modal in react 16
require("./static/adapter-for-react-16");
