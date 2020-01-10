# World Sim data

This data repo supports World Sim.

The World Sim is a collaborative project where you can learn about our complex world through games.

    TODO get video of building wind turbines and coal plants and finishing a level

Those simulations contain lots of data and complex relationships that as a player you can learn intuitively.  And can learn without ever having to understand compound O&M (operations and maintenance) costs or [trigonometry for solar](https://github.com/pingswept/pysolar/blob/0c61df6/pysolar/solar.py#L50) insolation for solar panels.

But that data and those relationships need to live somewhere and that's what this repository is for.

## Future plans

* Add multiple maintainers to the repo to allow more than one objective reviewer to accept changes.
* To make it easier for people to contribute the data: build a web tool to simplify editing, adding, questioning, discussing and resolving disputed data more easily.
* Move to using the web tool for all changes to the repo.

## Usage flows

Add more

### Add towards source

For example: you read an article and extract the data from a graph in the article:

    {
        "schema_version": "0.1",
        "data": {
            "number_of_generators_by_year": {
                "value_refs": [
                    {
                        "values": [[2000, 2.9], [2001, 3], [2002, 5.9], [2003, 7]],
                        "columns": ["year", "number_of_generators"],
                        "ref": "https://somesite.com/somearticle",
                        "sub ref": "figure 5, red line",
                        "comment": "Data extracted manually using WebPlotDigitiser https://apps.automeris.io/wpd/",
                        "data_sets": ["core@0.1"]
                    }
                ]
            }
        }
    }

Then later you or someone else goes to the source data and copies the data directly from that:

    {
        "schema_version": "0.1",
        "data": {
            "number_of_generators_by_year": {
                "value_refs": [
                    {
                        "values": [[2000, 3], [2001, 3], [2002, 6], [2003, 7]],
                        "columns": ["year", "number_of_generators"],
                        "ref": "https://originaldata.com/source_data.csv",
                        "sub ref": "",
                        "comment": "Data copied manually from original source.  Replaces core@0.1",
                        "data_sets": ["core@0.2"]
                    },
                    {
                        "values": [[2000, 2.9], [2001, 3], [2002, 5.9], [2003, 7]],
                        "columns": ["year", "number_of_generators"],
                        "ref": "https://somesite.com/somearticle",
                        "sub ref": "figure 5, red line",
                        "comment": "Data extracted manually using WebPlotDigitiser https://apps.automeris.io/wpd/",
                        "data_sets": ["core@0.1"]
                    }
                ]
            }
        }
    }
