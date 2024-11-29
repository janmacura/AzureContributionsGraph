const organization = "raet";
const apiVersion = "api-version=7.1";
const apiTop = 10000;
const minTime = "2024-01-01";

var project = "";
var personalAccessToken = "";
var authHeader = "";
var headers = new Headers();
var stats = {};
var contributionChart = null;

const fetchData = async (url) => {
    const response = await fetch(url, { headers });
    return response.json();
};

const getRepos = async () => {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories?${apiVersion}`;
    const data = await fetchData(url);
    return data.value || [];
};

const getCommits = async (repoId, page = 1) => {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoId}/commits?searchCriteria.fromDate=${minTime}&$top=${apiTop}&$skip=${(page - 1) * apiTop}&${apiVersion}`;
    const data = await fetchData(url);
    return data;
};

const getPullRequests = async (repoId, page = 1) => {
    const url = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repoId}/pullrequests?searchCriteria.status=completed&searchCriteria.minTime=${minTime}&$top=${apiTop}&$skip=${(page - 1) * apiTop}&${apiVersion}`;
    const data = await fetchData(url);
    return data;
};

const createUser = function (user) {
    if (stats[user] === undefined) {
        stats[user] = {
            "commits": 0,
            "pullRequestsCreated": 0,
            "pullRequestsReviewed": 0
        }
    }
}

const aggregateDataByUser = async () => {
    const repos = await getRepos();

    for (const repo of repos) {
        if (!repo.isDisabled) {

            let page = 1;
            let commits;

            do {
                commits = await getCommits(repo.id, page);
                commits.value.forEach(commit => {
                    const author = commit.author.email;
                    createUser(author);
                    stats[author].commits = (stats[author].commits || 0) + 1;
                });
                page++;
            } while (commits.value.length === apiTop); // Continue if page is full (potentially more pages)

            page = 1;
            let pullRequests;

            do {
                pullRequests = await getPullRequests(repo.id, page);
                pullRequests.value.forEach(pr => {
                    const creator = pr.createdBy.uniqueName;
                    createUser(creator);

                    for (var i = 0; i < pr.reviewers.length; i++) {
                        const reviewer = pr.reviewers[i].uniqueName;
                        if (reviewer == "janmac@youforce.net") {
                            console.log(pr);
                        }
                        createUser(reviewer);
                        stats[reviewer].pullRequestsReviewed = (stats[reviewer].pullRequestsReviewed || 0) + 1;
                    }

                    stats[creator].pullRequestsCreated = (stats[creator].pullRequestsCreated || 0) + 1;
                });
                page++;
            } while (pullRequests.value.length === apiTop); // Continue if page is full (potentially more pages)
        }
    }

    console.log("Contributions graph data:", stats);

    const labels = Object.keys(stats);
    const commits = Object.values(stats).map(item => item.commits);
    const pullRequestsCreated = Object.values(stats).map(item => item.pullRequestsCreated);
    const pullRequestsReviewed = Object.values(stats).map(item => item.pullRequestsReviewed);

    hideLoading();
    destroyChart();

    const ctx = document.getElementById('stackedBarChart').getContext('2d');
    contributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Commits',
                    data: commits,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                },
                {
                    label: 'Pull Requests Created',
                    data: pullRequestsCreated,
                    backgroundColor: 'rgba(153, 102, 255, 0.5)',
                },
                {
                    label: 'Pull Requests Reviewed',
                    data: pullRequestsReviewed,
                    backgroundColor: 'rgba(255, 159, 64, 0.5)',
                }
            ]
        },
        options: {
            plugins: {
                legend: {
                    position: 'top',
                },
            },
            responsive: true,
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true
                }
            }
        }
    });
};

const scanButtonClicked = function () {
    project = document.getElementById("projectName").value;
    console.log(project);
    personalAccessToken = document.getElementById("PATtoken").value;
    console.log(personalAccessToken);
    if (project !== "" && personalAccessToken !== "") {
        authHeader = 'Basic ' + btoa(':' + personalAccessToken);
        headers = new Headers({
            "Content-Type": "application/json",
            "Authorization": authHeader
        });
        destroyChart();
        showLoading();
        aggregateDataByUser().catch(error => {
            hideLoading();
            console.error('Error:', error);
            alert("Please check if the given Azure DevOps Project Name and Azure Personal Access Token are corrent and valid.");
        });
    } else {
        alert("Pleae enter Azure DevOps Project Name and Azure Personal Access Token.");
    }
}

const showLoading = function () {
    var x = document.getElementById("loading");
    x.style.display = "block";
}

const hideLoading = function () {
    var x = document.getElementById("loading");
    x.style.display = "none";
}

const destroyChart = function () {
    const ctx = document.getElementById('stackedBarChart').getContext('2d');
    if (contributionChart) {
        contributionChart.destroy();
    }
}

window.onload = (event) => {
    console.log("page is fully loaded");
    document.getElementById("scanButton").addEventListener("click", (scanButtonClicked));
};

